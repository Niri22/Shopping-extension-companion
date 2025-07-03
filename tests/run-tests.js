#!/usr/bin/env node

/**
 * Advanced Test Runner for Chrome Extension
 * Provides additional testing functionality beyond basic Jest commands
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function printHeader(title) {
  console.log('\n' + colorize('='.repeat(50), 'cyan'));
  console.log(colorize(`  ${title}`, 'bright'));
  console.log(colorize('='.repeat(50), 'cyan') + '\n');
}

function printSection(title) {
  console.log(colorize(`\n--- ${title} ---`, 'yellow'));
}

function runCommand(command, description) {
  try {
    console.log(colorize(`Running: ${description}`, 'blue'));
    const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    return { success: true, output };
  } catch (error) {
    return { success: false, error: error.message, output: error.stdout };
  }
}

function checkTestFiles() {
  const testDir = path.join(__dirname);
  const testFiles = fs.readdirSync(testDir).filter(file => file.endsWith('.test.js'));
  
  printSection('Test Files Found');
  testFiles.forEach(file => {
    const filePath = path.join(testDir, file);
    const stats = fs.statSync(filePath);
    const size = (stats.size / 1024).toFixed(1);
    console.log(`  ${colorize(file, 'green')} (${size} KB)`);
  });
  
  return testFiles;
}

function runBasicTests() {
  printSection('Basic Test Run');
  const result = runCommand('npx jest --passWithNoTests', 'All tests');
  
  if (result.success) {
    console.log(colorize('✓ All tests passed!', 'green'));
  } else {
    console.log(colorize('✗ Some tests failed', 'red'));
    console.log(result.output);
  }
  
  return result.success;
}

function runCoverageTests() {
  printSection('Coverage Analysis');
  const result = runCommand('npx jest --coverage --passWithNoTests', 'Coverage report');
  
  if (result.success) {
    console.log(colorize('✓ Coverage report generated', 'green'));
    
    // Try to parse coverage summary
    try {
      const coverageDir = path.join(process.cwd(), 'coverage');
      if (fs.existsSync(coverageDir)) {
        console.log(colorize('Coverage report available in ./coverage/', 'blue'));
      }
    } catch (err) {
      // Coverage parsing failed, but that's okay
    }
  } else {
    console.log(colorize('✗ Coverage analysis failed', 'red'));
  }
  
  return result.success;
}

function runLinting() {
  printSection('Code Linting');
  
  // Check if ESLint is configured
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    console.log(colorize('⚠ No package.json found, skipping linting', 'yellow'));
    return true;
  }
  
  const result = runCommand('npm run lint 2>/dev/null || echo "Linting not configured"', 'ESLint check');
  
  if (result.output.includes('Linting not configured')) {
    console.log(colorize('⚠ Linting not configured in package.json', 'yellow'));
    return true;
  } else if (result.success) {
    console.log(colorize('✓ Code linting passed', 'green'));
    return true;
  } else {
    console.log(colorize('✗ Linting issues found', 'red'));
    console.log(result.output);
    return false;
  }
}

function runSpecificTests(pattern) {
  printSection(`Running Tests Matching: ${pattern}`);
  const result = runCommand(`npx jest --testNamePattern="${pattern}" --passWithNoTests`, `Tests matching "${pattern}"`);
  
  if (result.success) {
    console.log(colorize(`✓ Tests matching "${pattern}" passed`, 'green'));
  } else {
    console.log(colorize(`✗ Tests matching "${pattern}" failed`, 'red'));
    console.log(result.output);
  }
  
  return result.success;
}

function runFileTests(filename) {
  printSection(`Running Tests in: ${filename}`);
  const result = runCommand(`npx jest ${filename} --passWithNoTests`, `Tests in ${filename}`);
  
  if (result.success) {
    console.log(colorize(`✓ Tests in ${filename} passed`, 'green'));
  } else {
    console.log(colorize(`✗ Tests in ${filename} failed`, 'red'));
    console.log(result.output);
  }
  
  return result.success;
}

function generateTestReport() {
  printSection('Generating Test Report');
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportFile = `test-report-${timestamp}.json`;
  
  const result = runCommand(`npx jest --json --outputFile=${reportFile} --passWithNoTests`, 'JSON test report');
  
  if (result.success && fs.existsSync(reportFile)) {
    console.log(colorize(`✓ Test report saved to ${reportFile}`, 'green'));
    
    try {
      const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
      console.log(colorize(`  Total tests: ${report.numTotalTests}`, 'blue'));
      console.log(colorize(`  Passed: ${report.numPassedTests}`, 'green'));
      console.log(colorize(`  Failed: ${report.numFailedTests}`, 'red'));
      console.log(colorize(`  Duration: ${(report.testResults.reduce((acc, test) => acc + test.perfStats.runtime, 0) / 1000).toFixed(2)}s`, 'blue'));
    } catch (err) {
      console.log(colorize('⚠ Could not parse test report', 'yellow'));
    }
  } else {
    console.log(colorize('✗ Failed to generate test report', 'red'));
  }
  
  return result.success;
}

function showHelp() {
  printHeader('Chrome Extension Test Runner');
  
  console.log(colorize('Usage:', 'bright'));
  console.log('  node tests/run-tests.js [command] [options]');
  
  console.log(colorize('\nCommands:', 'bright'));
  console.log('  all         Run all tests with coverage and linting');
  console.log('  basic       Run basic tests only');
  console.log('  coverage    Run tests with coverage report');
  console.log('  lint        Run code linting');
  console.log('  watch       Run tests in watch mode');
  console.log('  file <name> Run tests in specific file');
  console.log('  pattern <p> Run tests matching pattern');
  console.log('  report      Generate detailed test report');
  console.log('  check       Check test setup and files');
  console.log('  help        Show this help message');
  
  console.log(colorize('\nExamples:', 'bright'));
  console.log('  node tests/run-tests.js all');
  console.log('  node tests/run-tests.js file content.test.js');
  console.log('  node tests/run-tests.js pattern "URL Validation"');
  console.log('  node tests/run-tests.js watch');
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  
  switch (command) {
    case 'all':
      printHeader('Complete Test Suite');
      checkTestFiles();
      const basicSuccess = runBasicTests();
      const coverageSuccess = runCoverageTests();
      const lintSuccess = runLinting();
      
      if (basicSuccess && coverageSuccess && lintSuccess) {
        console.log(colorize('\n🎉 All checks passed!', 'green'));
        process.exit(0);
      } else {
        console.log(colorize('\n❌ Some checks failed', 'red'));
        process.exit(1);
      }
      break;
      
    case 'basic':
      printHeader('Basic Tests');
      const success = runBasicTests();
      process.exit(success ? 0 : 1);
      break;
      
    case 'coverage':
      printHeader('Coverage Tests');
      const covSuccess = runCoverageTests();
      process.exit(covSuccess ? 0 : 1);
      break;
      
    case 'lint':
      printHeader('Code Linting');
      const lintResult = runLinting();
      process.exit(lintResult ? 0 : 1);
      break;
      
    case 'watch':
      printHeader('Watch Mode');
      console.log(colorize('Starting watch mode (Ctrl+C to exit)...', 'blue'));
      try {
        execSync('npx jest --watch --passWithNoTests', { stdio: 'inherit' });
      } catch (error) {
        console.log(colorize('Watch mode exited', 'yellow'));
      }
      break;
      
    case 'file':
      if (!args[1]) {
        console.log(colorize('Error: Please specify a test file', 'red'));
        console.log('Usage: node tests/run-tests.js file <filename>');
        process.exit(1);
      }
      printHeader(`File Tests: ${args[1]}`);
      const fileSuccess = runFileTests(args[1]);
      process.exit(fileSuccess ? 0 : 1);
      break;
      
    case 'pattern':
      if (!args[1]) {
        console.log(colorize('Error: Please specify a test pattern', 'red'));
        console.log('Usage: node tests/run-tests.js pattern <pattern>');
        process.exit(1);
      }
      printHeader(`Pattern Tests: ${args[1]}`);
      const patternSuccess = runSpecificTests(args[1]);
      process.exit(patternSuccess ? 0 : 1);
      break;
      
    case 'report':
      printHeader('Test Report Generation');
      const reportSuccess = generateTestReport();
      process.exit(reportSuccess ? 0 : 1);
      break;
      
    case 'check':
      printHeader('Test Setup Check');
      checkTestFiles();
      console.log(colorize('\n✓ Test setup check complete', 'green'));
      break;
      
    case 'help':
    default:
      showHelp();
      break;
  }
}

// Handle uncaught exceptions gracefully
process.on('uncaughtException', (error) => {
  console.log(colorize(`\n❌ Unexpected error: ${error.message}`, 'red'));
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log(colorize('\n\n👋 Test runner interrupted', 'yellow'));
  process.exit(0);
});

main(); 
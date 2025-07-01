const fs = require('fs');
const { JSDOM } = require('jsdom');
const axios = require('axios');
const xmlBuilder = require('xmlbuilder');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const jsPath = path.join(__dirname, '../script.js');
const jsContent = fs.readFileSync(jsPath, 'utf8');
const esprima = require('esprima');
const calculator = require('../script'); // import module

class TestCaseResultDto {
    constructor(methodName, methodType, actualScore, earnedScore, status, isMandatory, errorMessage) {
        this.methodName = methodName;
        this.methodType = methodType;
        this.actualScore = actualScore;
        this.earnedScore = earnedScore;
        this.status = status;
        this.isMandatory = isMandatory;
        this.errorMessage = errorMessage;
    }
}

class TestResults {
    constructor() {
        this.testCaseResults = {};
        this.customData = '';
    }
}

function deleteOutputFiles() {
    ["./output_revised.txt", "./output_boundary_revised.txt", "./output_exception_revised.txt"].forEach(file => {
        if (fs.existsSync(file)) fs.unlinkSync(file);
    });
}

function checkHtmlTags(htmlContent, requiredTags) {
    const dom = new JSDOM(htmlContent);
    const results = {};
    requiredTags.forEach(tag => {
        results[tag] = dom.window.document.getElementsByTagName(tag).length > 0 ? 'pass' : 'fail';
    });
    return results;
}

function checkHtmlAttributes(htmlContent, tagName, attributes) {
    const dom = new JSDOM(htmlContent);
    const elements = dom.window.document.getElementsByTagName(tagName);
    const attributeResults = {};
    attributes.forEach(attribute => {
        let found = false;
        for (let el of elements) {
            if (el.hasAttribute(attribute)) {
                found = true;
                break;
            }
        }
        attributeResults[attribute] = found ? 'pass' : 'fail';
    });
    return attributeResults;
}

function testToggleTheme(jsContent) {
    const dom = new JSDOM(`<!DOCTYPE html><body><button id="toggle-theme">Light</button></body>`, {
        runScripts: "dangerously",
        resources: "usable"
    });

    const { window } = dom;

    // Inject script into DOM
    const scriptEl = window.document.createElement("script");
    scriptEl.textContent = jsContent;
    window.document.body.appendChild(scriptEl);

    // Simulate theme toggle
    window.toggleTheme?.();

    const hasDarkMode = window.document.body.classList.contains("dark-mode");
    const buttonText = window.document.getElementById("toggle-theme")?.textContent;

    return {
        toggleTheme:
            hasDarkMode && buttonText === "Dark" ? "pass" : "fail"
    };
}

function testCalculateBill(jsContent) {
    const dom = new JSDOM(
        `<!DOCTYPE html>
     <body>
       <input id="amount" value="100" />
       <input id="tip" value="10" />
       <select id="people">
         <option value="2" selected>2</option>
       </select>
       <span id="tip-amount"></span>
       <span id="per-person"></span>
     </body>`,
        {
            runScripts: "dangerously",
            resources: "usable"
        }
    );

    const { window } = dom;

    // Inject the script content into the simulated DOM
    const scriptEl = window.document.createElement("script");
    scriptEl.textContent = jsContent;
    window.document.body.appendChild(scriptEl);

    // Call the function
    window.calculateBill?.();

    const tipText = window.document.getElementById("tip-amount")?.textContent;
    const perPersonText = window.document.getElementById("per-person")?.textContent;

    const tipPass = tipText === "₹10.00";
    const perPersonPass = perPersonText === "₹55.00";

    return {
        calculateBill: tipPass && perPersonPass ? "pass" : "fail"
    };
}

function checkCssFileStyles(cssContent, requiredStyles) {
    const result = {};

    requiredStyles.forEach(styleCheck => {
        const { selector, properties } = styleCheck;
        const blockRegex = new RegExp(`${selector}\\s*\\{([^}]+)\\}`, 'g');
        const match = blockRegex.exec(cssContent);

        if (!match) {
            result[selector] = 'fail';
            return;
        }

        const styleBlock = match[1];
        let allFound = true;

        for (const [prop, value] of Object.entries(properties)) {
            const propRegex = new RegExp(`${prop}\\s*:\\s*${value}\\s*;`);
            if (!propRegex.test(styleBlock)) {
                allFound = false;
                break;
            }
        }

        result[selector] = allFound ? 'pass' : 'fail';
    });

    return result;
}

function formatTestResults(results, methodName, methodType) {
    const result = new TestCaseResultDto(
        methodName,
        methodType,
        1,
        Object.values(results).includes('fail') ? 0 : 1,
        Object.values(results).includes('fail') ? 'Failed' : 'Passed',
        true,
        ''
    );
    const testResults = new TestResults();
    const id = uuidv4();
    testResults.testCaseResults[id] = result;
    testResults.customData = 'Simple Calculator HTML Test';
    return testResults;
}

function generateXmlReport(result) {
    return xmlBuilder.create('test-cases')
        .ele('case')
        .ele('test-case-type', result.status).up()
        .ele('name', result.methodName).up()
        .ele('status', result.status).up()
        .end({ pretty: true });
}

function writeOutputFiles(result, fileType) {
    let output = `${result.methodName}=${result.status === 'Passed' ? 'PASS' : 'FAIL'}\n`;
    const outputMap = {
        functional: "./output_revised.txt",
        boundary: "./output_boundary_revised.txt",
        exception: "./output_exception_revised.txt"
    };
    fs.appendFileSync(outputMap[fileType] || outputMap.functional, output);
}

async function handleTestCase(filePath, testCaseName, testCaseType, testLogic, extraParams = {}) {
    try {
        const data = fs.readFileSync(filePath, 'utf8');

        // Run the test logic
        const results = Array.isArray(extraParams)
            ? testLogic(data, ...extraParams)
            : testLogic(data, ...Object.values(extraParams));

        // Build test result structure
        const testResults = formatTestResults(results, testCaseName, testCaseType);
        const customFilePath = path.join(__dirname, '../../../custom.ih');
        testResults.customData = fs.readFileSync(customFilePath, 'utf8');

        // console.log(`${testCaseType} Results:`, results);
        const chalkRed = (text) => `\x1b[31m${text}\x1b[0m`; // red
        const chalkGreen = (text) => `\x1b[32m${text}\x1b[0m`; // green

        console.log(`${testCaseType} Results:`);

        for (const [key, value] of Object.entries(results)) {
            if (value === 'fail') {
                console.log(`  ${key}: ${chalkRed('FAIL')}`);
            } else {
                console.log(`  ${key}: ${chalkGreen('PASS')}`);
            }
        }

        console.log("=================");
        console.log(testResults);

        // Send to results server
        const response = await axios.post(
            'https://compiler.techademy.com/v1/mfa-results/push',
            testResults,
            { headers: { 'Content-Type': 'application/json' } }
        );
        console.log(`${testCaseType} Test Case Server Response:`, response.data);

        // Write XML + output files
        const testCaseId = Object.keys(testResults.testCaseResults)[0];
        const xml = generateXmlReport(testResults.testCaseResults[testCaseId]);
        fs.writeFileSync(`${testCaseType.toLowerCase().replace(' ', '-')}-test-report.xml`, xml);

        writeOutputFiles(testResults.testCaseResults[testCaseId], 'functional');

    } catch (err) {
        console.error(`Error executing ${testCaseType} test case:`, err);
    }
}

// Updated execution flow
function executeAllTestCases() {
    deleteOutputFiles();

    const filePath = path.join(__dirname, '../index.html');
    const jsPath = path.join(__dirname, '../script.js');
    const jsContent = fs.readFileSync(jsPath, 'utf8');
    const cssFilePath = path.join(__dirname, '../style.css');
    const cssContent = fs.readFileSync(cssFilePath, 'utf8');


    const htmlTagsTestCase = {
        testCaseName: 'HTML Tags Test',
        testCaseType: 'boundary',
        testLogic: checkHtmlTags,
        extraParams: [['html', 'head', 'title', 'link', 'body', 'div', 'button', 'label', 'input', 'select', 'option', 'p', 'script']]
    };

    const linkAttrTestCase = {
        testCaseName: 'Link Tag Attribute Test',
        testCaseType: 'boundary',
        testLogic: checkHtmlAttributes,
        extraParams: ['link', ['rel', 'href']]
    };

    const scriptAttrTestCase = {
        testCaseName: 'Script Tag Attribute Test',
        testCaseType: 'boundary',
        testLogic: checkHtmlAttributes,
        extraParams: ['script', ['src']]
    };

    const inputAttrTestCase = {
        testCaseName: 'Input Tag Attribute Test',
        testCaseType: 'boundary',
        testLogic: checkHtmlAttributes,
        extraParams: ['input', ['type']]
    };

    const testToggleThemeTestCase = {
        testCaseName: 'testToggleTheme Functionality Test',
        testCaseType: 'functional',
        testLogic: testToggleTheme
    };

    const testCalculateBillTestCase = {
        testCaseName: 'testCalculateBill Functionality Test',
        testCaseType: 'functional',
        testLogic: testCalculateBill
    };

    const cssFileStyleTestCase = {
        testCaseName: 'CSS File Style Test',
        testCaseType: 'boundary',
        testLogic: checkCssFileStyles,
        extraParams: [[
            { selector: 'body', properties: { 'display': 'flex', 'justify-content': 'center', 'background-color': '#f5f5f5' } },
            { selector: '.container', properties: { 'width': '100%', 'position': 'relative' } },
            { selector: 'h1', properties: { 'text-align': 'center', 'margin-bottom': '1.5rem' } },
            { selector: 'label', properties: { 'display': 'block', 'margin-top': '1rem', 'font-weight': 'bold' } },
            { selector: '.payment-options', properties: { 'display': 'flex', 'justify-content': 'space-between' } },
            { selector: '.output', properties: { 'margin-top': '1.5rem', 'font-weight': 'bold' } },
        ]]
    };

    [
        htmlTagsTestCase,
        linkAttrTestCase,
        scriptAttrTestCase,
        inputAttrTestCase,
        testToggleThemeTestCase,
        testCalculateBillTestCase,
        cssFileStyleTestCase
    ].forEach(tc =>
        handleTestCase(
            tc.testLogic === testCalculateBill ||
                tc.testLogic === testToggleTheme ? jsPath :
                tc.testLogic === checkCssFileStyles ? cssFilePath :
                    filePath,
            tc.testCaseName,
            tc.testCaseType,
            tc.testLogic,
            tc.extraParams || {})
    );
}

executeAllTestCases();

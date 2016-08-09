'use strict';

const Fs = require('fs');
const Path = require('path');
const Jade = require('jade');
const _ = require('lodash');


// when use use fit, jasmine never calls suiteStarted / suiteDone, so make a fake one to use
const fakeFocusedSuite = {
    id: 'focused',
    description: 'focused specs',
    fullName: 'focused specs'
};

const JasmineReporterMixin = Base => class extends Base {

    _expectDiffToBeValid(diffData) {
        expect(diffData.misMatchPercentage).not.toBeGreaterThan(this.options.mismatchThreshold);
    }

    _expectNoError(error) {
        expect(error).toBeFalsy();
    }

    addImageToReport(image) {
        this._currentSpec._screenshots.push(image);
    }

    _getSuite(suite) {
        this._suitsHash[suite.id] = _.assign(this._suitsHash[suite.id] || {}, suite);
        return this._suitsHash[suite.id];
    }

    _getSpec(spec) {
        this._specsHash[spec.id] = _.assign(this._specsHash[spec.id] || {}, spec);
        return this._specsHash[spec.id];
    }

    jasmineStarted(summary) {
        this._suites = [];
        this._currentSuite = null;
        this._currentSpec = null;
        this._totalSpecsExecuted = 0;
        this._totalSpecsDefined = summary && summary._totalSpecsDefined || NaN;
        this._suitsHash = {};
        this._specsHash = {};
        
        jasmine.getEnv().imageDiffTester = this;
    }

    suiteStarted(suite) {
        suite = this._getSuite(suite);
        suite._startTime = new Date();
        suite._specs = [];
        suite._suites = [];
        suite._failures = 0;
        suite._skipped = 0;
        suite._disabled = 0;
        suite._parent = this._currentSuite;
        if (!this._currentSuite) {
            this._suites.push(suite);
        } else {
            this._currentSuite._suites.push(suite);
        }
        this._currentSuite = suite;
    }

    specStarted(spec) {
        if (!this._currentSuite) {
            // focused spec (fit) -- suiteStarted was never called
            this.suiteStarted(fakeFocusedSuite);
        }
        spec = this._getSpec(spec);
        spec._screenshots = [];
        spec._startTime = new Date();
        spec._suite = this._currentSuite;
        this._currentSuite._specs.push(spec);
        this._currentSpec = spec;
    }

    specDone(spec) {
        spec = this._getSpec(spec);
        spec._endTime = new Date();
        spec._hasScreenshots = spec._screenshots.length > 0;
        switch(spec.status) {
            case 'failed':
                spec._suite._failures += spec.failedExpectations.length;
                break;
            case 'pending':
                spec._suite._skipped++;
                break;
            case 'disabled':
                spec._suite._disabled++;
                break;
        }
        this._totalSpecsExecuted++;
        this._currentSpec = null;
    }

    suiteDone(suite) {
        suite = this._getSuite(suite);
        if (_.isUndefined(suite._parent)) {
            // disabled suite (xdescribe) -- suiteStarted was never called
            this.suiteStarted(suite);
        }
        suite._endTime = new Date();
        suite._hasScreenshots = _.find(suite._suites, '_hasScreenshots') ||
            _.find(suite._specs, '_hasScreenshots');
        this._currentSuite = suite._parent;
    }

    jasmineDone() {
        if (this._currentSuite) {
            // focused spec (fit) -- suiteDone was never called
            this.suiteDone(fakeFocusedSuite);
        }
        this._writeReport();
    }

    _generateReport() {
        const templatePath = Path.join(__dirname, 'screenshotsReport.jade');
        return Jade.renderFile(templatePath, {
            pretty: true,
            suites: this._suites
        });
    }

    _writeReport() {
        const reportPath = Path.join(
            this.options.mode === 'test' ? this.options.currentDir : this.options.baseDir,
            'report.html'
        );
        Fs.writeFileSync(reportPath, this._generateReport(), 'utf8');
    }
};

module.exports = JasmineReporterMixin;
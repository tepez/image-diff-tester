'use strict';

const JasmineReporterMixin = require('./reporters/jasmine');
const ProtractorScreenshotsMixin = require('./mixins/protractor');
const ImageDiffTester = require('./imageDiffTester');

class ProtractorJasmineImageDiffTester extends ProtractorScreenshotsMixin(JasmineReporterMixin(ImageDiffTester)) {

}

module.exports = ProtractorJasmineImageDiffTester;
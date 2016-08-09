'use strict';

const JasmineReporterMixin = require('./reporters/jasmine');
const ImageDiffTester = require('./imageDiffTester');

class NodeJasmineImageDiffTester extends JasmineReporterMixin(ImageDiffTester) {

}

module.exports = NodeJasmineImageDiffTester;
'use strict';

const Path = require('path');
const Fs = require('fs');
const Resemble = require('node-resemble-js');
const Joi = require('joi');
const Bluebird = require('bluebird');
const Del = require('del');
const Isstream = require('isstream');
const _ = require('lodash');
const Mkdirp = require('mkdirp');
const StreamToArray = require('stream-to-array');

const MkdirpAsync = Bluebird.promisify(Mkdirp);


class ImageDiffTester {

    constructor(options) {
        options = _.defaults({}, options, {
            mode: 'test',
            baseDir: 'screenshots/base',
            currentDir: 'screenshots/current',
            diffDir: 'screenshots/diff',
            mismatchThreshold: 0
        });

        Joi.assert(options, Joi.object().keys({
            mode: Joi.string().only('rebase', 'test').required(),
            baseDir: Joi.string().required(),
            currentDir: Joi.string().required(),
            diffDir: Joi.string().required(),
            mismatchThreshold: Joi.number().min(0).max(100).required()
        }));

        this.options = options;
    }

    _defer() {
        let resolve, reject;
        let promise = new Bluebird(function() {
            resolve = arguments[0];
            reject = arguments[1];
        });
        return {
            resolve: resolve,
            reject: reject,
            promise: promise
        };
    }

    _promisifier(originalMethod) {
        return function promisified() {
            var args = [].slice.call(arguments);
            return new Bluebird((resolve, reject) => {
                function promisifierCb(err, value) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(value);
                    }
                }
                args.push(promisifierCb);

                originalMethod.apply(this, args);
            });
        };
    }

    _streamToBuffer(stream) {
        const StreamToArrayAsync = this._promisifier(StreamToArray);
        return StreamToArrayAsync(stream).then(function (parts) {
            const buffers = parts.map((part) => {
                return (part instanceof Buffer) ? part : new Buffer(part);
            });
            return Buffer.concat(buffers);
        });
    }

    initDirectories() {
        const dirsToDelete = [
            this.options.currentDir + '/**',
            this.options.diffDir + '/**'
        ];
        if (this.options.mode == 'rebase') {
            dirsToDelete.push(this.options.baseDir + '/**');
        }
        return Bluebird.resolve(Del(dirsToDelete)).then(() => {
            return Bluebird.all([
                MkdirpAsync(this.options.baseDir),
                MkdirpAsync(this.options.currentDir),
                MkdirpAsync(this.options.diffDir)
            ]);
        });
    }

    static _pngBufferToDataUrl(buffer) {
        return `data:image/png;base64,${buffer.toString('base64')}`;
    }

    _imagePath(name, mode) {
        const fileName = `${name}.png`;
        const directory = {
            base: this.options.baseDir,
            current: this.options.currentDir,
            diff: this.options.diffDir
        }[mode];
        return Path.join(directory, fileName);
    }

    _compareImages(screenshotName) {
        const deferred = this._defer();
        const basePng = Fs.readFileSync(this._imagePath(screenshotName, 'base'));
        const currentPng = Fs.readFileSync(this._imagePath(screenshotName, 'current'));

        Resemble(currentPng)
            .compareTo(basePng)
            .ignoreAntialiasing()
            .onComplete(deferred.resolve);

        let diffData;

        return deferred.promise.then((_diffData) => {
            diffData = _diffData;
            // misMatchPercentage is given as a string, convert it to float
            diffData.misMatchPercentage = parseFloat(diffData.misMatchPercentage);
            this._expectDiffToBeValid(diffData);

            return diffData.misMatchPercentage == 0 ? null : this._streamToBuffer(diffData.getDiffImage().pack());
        }).then((diffBuffer) => {
            if (diffData.misMatchPercentage !== 0) {
                console.log(`Warning: Screenshot "${screenshotName}" mismatch of ${diffData.misMatchPercentage}%`);
                const diffPath = this._imagePath(screenshotName, 'diff');
                Mkdirp.sync(Path.dirname(diffPath));
                Fs.writeFileSync(diffPath, diffBuffer);
            }

            this.addImageToReport({
                name: screenshotName,
                base: ImageDiffTester._pngBufferToDataUrl(basePng),
                diff: diffBuffer ? ImageDiffTester._pngBufferToDataUrl(diffBuffer) : null,
                current: ImageDiffTester._pngBufferToDataUrl(currentPng),
                misMatchPercentage: diffData.misMatchPercentage,
                isSameDimensions: diffData.isSameDimensions,
                dimensionDifference: diffData.dimensionDifference,
                analysisTime: diffData.analysisTime
            });
        });
    }

    imageTaken(name, imgData) {
        const deferred = this._defer();
        deferred.resolve();
        return deferred.promise.then(() => {
            if (Buffer.isBuffer(imgData)) {
                return imgData;
            }  else if (Isstream.isReadable(imgData)) {
                return this._streamToBuffer(imgData);
            }
            throw new Error('image data must be either a stream or a buffer');
        }).then((imgData) => {
            const path = this._imagePath(name, this.options.mode === 'test' ? 'current' : 'base');
            Mkdirp.sync(Path.dirname(path));
            Fs.writeFileSync(path, imgData);

            // Compare current to base and create a diff if we are in test mode
            if (this.options.mode === 'test') {
                return this._compareImages(name, imgData);

                // Just save the image if we're rebasing
            } else {
                this.addImageToReport({
                    name: name,
                    base: ImageDiffTester._pngBufferToDataUrl(imgData)
                });
                return Bluebird.resolve();
            }
        }).then(null, (err) => {
            // We don't want an error to terminate the spec so we just make sure the spec fails
            // and log the error
            console.error(`imageTaken: could not handle image ${name}`);
            console.error(err);
            this._expectNoError(err);
        });
    }
}

module.exports = ImageDiffTester;



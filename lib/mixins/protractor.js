'use strict';

const PNG = require('pngjs').PNG;


const ProtractorScreenshotsMixin = Base => class extends Base {

    _defer() {
        const deferred = protractor.promise.defer();
        return {
            resolve: function() {
                deferred.fulfill.apply(deferred, arguments);
            },
            reject: function() {
                deferred.reject.apply(deferred, arguments);
            },
            promise: deferred.promise
        };
    }

    _promisifier(originalMethod) {
        return function promisified() {
            var args = [].slice.call(arguments);
            var deferred = protractor.promise.defer();

            function promisifierCb(err, value) {
                if (err) {
                    deferred.reject(err);
                } else {
                    deferred.fulfill(value);
                }
            }
            args.push(promisifierCb);

            originalMethod.apply(this, args);

            return deferred.promise;
        };
    }

    // This is a workaround until $().takeScreenshot will work
    // TODO remove when https://github.com/angular/protractor/issues/2892 is resolved
    _takeElementScreenshot(el, scrollToView) {
        const cropConfig = {};
        let fullScreenPng;

        return el.getSize().then((size) => {
            // The margins where chosen after inspecting the resulting screenshots
            cropConfig.height = size.height + 1;
            cropConfig.width = size.width + 2;
            return el.getLocation();
        }).then((location) => {
            cropConfig.top = location.y - 1;
            cropConfig.left = location.x - 1;

            if (scrollToView) {
                browser.executeScript(`window.scrollTo(0,${cropConfig.top - 1});`).then(() => {
                    return browser.executeScript("return window.scrollY;");
                }).then((scrollY) => {
                    return cropConfig.top -= scrollY;
                });
            }
            return browser.takeScreenshot();
        }).then((pngStr) => {
            fullScreenPng = new PNG();
            fullScreenPng.parseAsync = this._promisifier(fullScreenPng.parse);
            return fullScreenPng.parseAsync(new Buffer(pngStr, 'base64'));
        }).then(() => {
            const croppedPng = new PNG({
                width: cropConfig.width,
                height: cropConfig.height
            });
            fullScreenPng.bitblt(
                croppedPng,
                cropConfig.left,    // sourceX
                cropConfig.top,     // sourceY
                cropConfig.width,   // sourceHeight
                cropConfig.height,  // sourceWidth
                0,                  // destinationX
                0                   // destinationY
            );
            return this._streamToBuffer(croppedPng.pack());
        });
    }

    takeScreenshot(el, name, scrollToView) {
        return this._takeElementScreenshot(el, scrollToView).then((imgBuffer) => {
            return this.imageTaken(name, imgBuffer);
        });
    }
};

module.exports = ProtractorScreenshotsMixin;



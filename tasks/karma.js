/*global __dirname*/
module.exports = function (grunt) {
    'use strict';

    var path = require('path');
    var runner = require('karma').runner;
    var server = require('karma').server;

    function processValue(value) {
        if (typeof value === 'object') {
            if (Array.isArray(value)) {
                return value.map(processValue);
            } else {
                return processObject(value);
            }
        } else if (typeof value === 'string') {
            return grunt.template.process(value);
        }
        return value;
    }

    function processObject(obj) {
        var newObj = {};
        Object.keys(obj).forEach(function (k) {
            newObj[processValue(k)] = processValue(obj[k]);
        });
        return newObj;
    }

    function append(key, data, appendData) {
        var value = data[key], appendValue = appendData[key];
        if (!value) {
            data[key] = appendValue;
        } else if (typeof value === 'object') {
            if (Array.isArray(value)) {
                data[key] = value.concat(appendValue);
            } else {
                Object.keys(appendValue).forEach(function (k) {
                    append(k, value, appendValue[k]);
                });
            }
        } else if (typeof value === 'string') {
            data[key] = value + appendValue;
        } else {
            grunt.fail.fatal(new Error('Unable to append type ' + key + ':' + (typeof value)));
        }
    }

    function prepend(key, data, prependData) {
        var value = data[key], prependValue = prependData[key];
        if (!value) {
            data[key] = prependValue;
        } else if (typeof value === 'object') {
            if (Array.isArray(value)) {
                data[key] = prependValue.concat(value);
            } else {
                Object.keys(prependValue).forEach(function (k) {
                    prepend(k, value, prependValue[k]);
                });
            }
        } else if (typeof value === 'string') {
            data[key] = prependValue + value;
        } else {
            grunt.fail.fatal(new Error('Unable to prepend type ' + key + ':' + (typeof value)));
        }
    }

    grunt.registerMultiTask('karma', 'Run with karma runner.', function () {
        var done = this.async();
        var options = this.options({
            background: false
        });
        //merge options onto data, with data taking precedence
        //process data after merge
        var data = processObject(grunt.util._.merge(options, this.data));

        if (data.append) {
            Object.keys(data.append).forEach(function (k) {
                append(k, data, data.append);
            });
            delete data.append;
        }

        if (data.prepend) {
            Object.keys(data.prepend).forEach(function (k) {
                prepend(k, data, data.prepend);
            });
            delete data.prepend;
        }

        if (data.configFile) {
            data.configFile = path.resolve(data.configFile);
        }

        //support `karma run`, useful for grunt watch
        if (this.flags.run){
            runner.run(data, done);
            return;
        }

        //allow karma to be run in the background so it doesn't block grunt
        if (data.background){
            grunt.util.spawn({cmd: 'node', args: [path.join(__dirname, '..', 'lib', 'background.js'), JSON.stringify(data)]}, function(){});
            done();
        } else {
            server.start(data, function(code) {
                done(code === 0);
            });
        }
    });
};

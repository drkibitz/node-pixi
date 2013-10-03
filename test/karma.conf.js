module.exports = function(config) {
    config.set({

        // base path, that will be used to resolve files and exclude
        //basePath : './',

        frameworks : ['mocha'],

        // list of files / patterns to load in the browser
        //files : [],

        // list of files to exclude
        //exclude : [],

        // use dolts reporter, as travis terminal does not support escaping sequences
        // possible values: 'dots', 'progress', 'junit', 'teamcity'
        // CLI --reporters progress
        reporters : ['progress'],

        // web server port
        // CLI --port 9876
        port : 9876,

        // cli runner port
        // CLI --runner-port 9100
        runnerPort : 9100,

        // enable / disable colors in the output (reporters and logs)
        // CLI --colors --no-colors
        colors : true,

        // level of logging
        // possible values: karma.LOG_DISABLE || karma.LOG_ERROR || karma.LOG_WARN || karma.LOG_INFO || karma.LOG_DEBUG
        // CLI --log-level debug
        logLevel : config.LOG_DEBUG,

        // enable / disable watching file and executing tests whenever any file changes
        // CLI --auto-watch --no-auto-watch
        autoWatch : false,

        // Start these browsers, currently available:
        // - Chrome
        // - ChromeCanary
        // - Firefox
        // - Opera
        // - Safari (only Mac)
        // - PhantomJS
        // - IE (only Windows)
        // CLI --browsers Chrome,Firefox,Safari
        browsers : process.env.TRAVIS ? ['Firefox'] : ['Chrome'], // Sorry, I like Chrome

        // If browser does not capture in given timeout [ms], kill it
        // CLI --capture-timeout 5000
        captureTimeout : 5000,

        // Auto run tests on start (when browsers are captured) and exit
        // CLI --single-run --no-single-run
        singleRun : true,

        // report which specs are slower than 500ms
        // CLI --report-slower-than 500
        reportSlowerThan : 1000,

        //preprocessors : {
        //    '**/client/js/*.js': 'coverage'
        //},

        plugins : [
            'karma-mocha',
            'karma-chrome-launcher',
            'karma-firefox-launcher',
            'karma-phantomjs-launcher'
        ]
    });
};

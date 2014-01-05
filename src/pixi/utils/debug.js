/**
 * @author Dr. Kibitz <info@drkibitz.com>
 */
'use strict';

var platform = require('../platform');

function logGroup(name) {
    var console = platform.console;
    if (console.groupCollapsed) {
        console.groupCollapsed(name);
    } else if (console.group) {
        console.group(name);
    } else {
        console.log(name + ' >>>>>>>>>');
    }
}

function logGroupEnd(name) {
    var console = platform.console;
    if (console.groupEnd) {
        console.groupEnd(name);
    } else {
        console.log(name + ' _________');
    }
}

exports.runList = function runList(item, name)
{
    var safe = 0;
    var tmp = item.first;

    name = 'pixi.runList' + (name ? '(' + name + ')' : '');
    logGroup(name);
    platform.console.log(tmp);

    while(tmp._iNext)
    {
        safe++;
        tmp = tmp._iNext;
        platform.console.log(tmp);

        if(safe > 100)
        {
            platform.console.log('BREAK');
            break;
        }
    }
    logGroupEnd(name);
};

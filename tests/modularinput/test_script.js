
// Copyright 2014 Splunk, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License"): you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
// License for the specific language governing permissions and limitations
// under the License.

exports.setup = function() {

    var splunkjs        = require('../../index');
    var Service         = splunkjs.service;
    var Async           = splunkjs.Async;
    var ET              = require("elementtree");
    var modularinput    = splunkjs.ModularInput;
    var Script          = modularinput.Script;
    var Event           = modularinput.Event;
    var EventWriter     = modularinput.EventWriter;
    var Scheme          = modularinput.Scheme;
    var Argument        = modularinput.Argument;
    var utils           = modularinput.utils;

    splunkjs.Logger.setLevel("ALL");

    var TEST_SCRIPT_PATH = "__IGNORED_SCRIPT_PATH__";

    return {

        "Script tests": {
            setUp: function(done) {
                done();
            },

            "An error happens when a script has a null scheme": function(test) {
                // A script that returns a null scheme should generate no output on stdout
                // and an error on stderr saying that the scheme was null.

                var NewScript = new Script();
                
                NewScript.getScheme = function () {
                    return null;
                };
                NewScript.streamEvents = function () {
                    return; // not used
                };

                // TODO: make this work with streams
                var out = new Buffer(2048);
                var err = new Buffer(2048);
                var ew = new EventWriter(out, err);

                var inStream = new Buffer(2048);

                var args = [TEST_SCRIPT_PATH, "--scheme"];
                NewScript.runScript(args, ew, inStream, function(err, scriptStatus) {
                    test.ok(!err);
                    var error = ew._err.toString("utf-8", 0, 51);

                    test.strictEqual(0, ew.outPosition);
                    test.strictEqual(error, "FATAL Modular input script returned a null scheme.\n");
                    test.strictEqual(1, scriptStatus);
                    test.done();
                });
            },

            "Script properly generates Scheme": function(test) {
                // Check that a scheme generated by a script is what we expect.

                var NewScript = new Script();

                NewScript.getScheme = function() {
                    var scheme = new Scheme("abcd");
                    scheme.description = "\uC3BC and \uC3B6 and <&> f\u00FCr";
                    scheme.streamingMode = Scheme.streamingModeSimple;
                    scheme.useExternalValidation = false;
                    scheme.useSingleInstance = true;

                    var arg1 = new Argument("arg1");
                    scheme.addArgument(arg1);

                    var arg2 = new Argument("arg2");
                    arg2.description = "\uC3BC and \uC3B6 and <&> f\u00FCr";
                    arg2.dataType = Argument.dataTypeNumber;
                    arg2.requiredOnCreate = true;
                    arg2.requiredOnEdit = true;
                    arg2.validation = "is_pos_int('some_name')";
                    scheme.addArgument(arg2);

                    return scheme;
                };
                NewScript.streamEvents = function() {
                    return; // Not used
                };

                // TODO: make this work with streams
                var out = new Buffer(2048);
                var err = new Buffer(2048);
                var ew = new EventWriter(out, err);

                var inStream = new Buffer(2048);

                var args = [TEST_SCRIPT_PATH, "--scheme"];
                NewScript.runScript(args, ew, inStream, function(err, scriptStatus) {
                    test.ok(!err);

                    var expected = utils.readFile(__filename, "../data/scheme_without_defaults.xml");

                    // TODO: un-hardcode the 665 length for this test
                    var output = ew._out.toString("utf-8", 0, expected.length).substring(0, 665);

                    // TODO: fix this test
                    //test.ok(utils.XMLCompare(ET.parse(expected), ET.parse(output)));
                    test.strictEqual(0, scriptStatus);
                    test.strictEqual(0, ew.errPosition);
                    test.done();
                });
            },

            "Validation succeeds": function(test) {

                var NewScript = new Script();

                NewScript.getScheme = function() {
                    return null;
                };

                NewScript.validateInput = function(definition) {
                    return true; // Always succeed
                };

                NewScript.streamEvents = function() {
                    return; // not used
                };

                // TODO: make this work with streams
                var out = new Buffer(2048);
                var err = new Buffer(2048);
                var ew = new EventWriter(out, err);

                var args = [TEST_SCRIPT_PATH, "--validate-arguments"];

                var validationFile = utils.readFile(__filename, "../data/validation.xml");

                NewScript.runScript(args, ew, validationFile, function(err, scriptStatus) {
                    test.ok(!err);

                    test.strictEqual(0, ew.outPosition);
                    test.strictEqual(0, ew.errPosition);
                    test.strictEqual(0, scriptStatus);
                    test.done();
                });
            },

            "Validation fails": function(test) {

                var NewScript = new Script();

                NewScript.getScheme = function() {
                    return null;
                };

                NewScript.validateInput = function(definition) {
                    throw new Error("Big fat validation error!");
                };

                NewScript.streamEvents = function() {
                    return; // not used
                };

                // TODO: make this work with streams
                var out = new Buffer(2048);
                var err = new Buffer(2048);
                var ew = new EventWriter(out, err);

                var args = [TEST_SCRIPT_PATH, "--validate-arguments"];

                var validationFile = utils.readFile(__filename, "../data/validation.xml");

                NewScript.runScript(args, ew, validationFile, function(err, scriptStatus) {
                    test.ok(err);
                    var expected = utils.readFile(__filename, "../data/validation_error.xml");
                    var output = ew._out.toString("utf-8", 0, expected.length);

                    //test.ok(utils.XMLCompare(ET.parse(expected), ET.parse(output)));
                    test.strictEqual(0, ew.errPosition);
                    test.strictEqual(1, scriptStatus);
                    test.done();
                });
            },

            "Writing events works": function(test) {
                var NewScript = new Script();

                NewScript.getScheme = function() {
                    return null;
                };

                NewScript.streamEvents = function(inputs, eventWriter, callback) {
                    var myEvent = new Event({
                        data: "This is a test of the emergency broadcast system.",
                        stanza: "fubar",
                        time: 1372275124.466,
                        host: "localhost",
                        index: "main",
                        source: "hilda",
                        sourcetype: "misc",
                        done: true,
                        unbroken: true
                    });
                    
                    Async.chain([
                            function (done) {
                                eventWriter.writeEvent(myEvent, done);
                            },
                            function (buffer, done) {
                                // TODO: remove
                                console.log(eventWriter._out.toString("utf-8", 0, eventWriter.outPosition));
                                eventWriter.writeEvent(myEvent, done);
                            },
                            function (buffer, done) {
                                // TODO: remove
                                console.log(eventWriter._out.toString("utf-8", 0, eventWriter.outPosition));
                                done(null);
                            }
                        ],
                        function (err) {
                            if (err) {
                                callback(err, 1);
                                return;
                            }
                            else {
                                callback(null, 0);
                                return;
                            }
                        }
                    );
                };

                // TODO: make this work with streams
                var out = new Buffer(4096);
                var err = new Buffer(4096);
                var ew = new EventWriter(out, err);

                var args = [TEST_SCRIPT_PATH];

                var inputConfiguration = utils.readFile(__filename, "../data/conf_with_2_inputs.xml");

                NewScript.runScript(args, ew, inputConfiguration, function(err, scriptStatus) {
                    test.ok(!err);

                    var expected = utils.readFile(__filename, "../data/stream_with_two_events.xml");
                    // TODO: this stream has some garbage at the end of it.
                    var found = ew._out.toString("utf-8", 0, ew.outPosition);
                    //console.log(found);
                    //test.ok(utils.XMLCompare(ET.parse(expected).getroot(), ET.parse(found).getroot()));
                    test.strictEqual(0, scriptStatus);
                    test.done();
                });
            },

            "Script gets a valid Service": function(test) {
                var NewScript = new Script();

                NewScript.getScheme = function() {
                    return null;
                };

                NewScript.validateInput = function(definition) {
                    return false;
                };

                NewScript.streamEvents = function(inputs, eventWriter, callback) {
                    var service = this.service();
                    
                    // TODO: find a better way of doing this test, the Service var is out of scope
                    test.ok(service instanceof require("../../lib/service"));
                    test.strictEqual(service.prefix, inputs.metadata["server_uri"]);
                    callback(null, 0);
                };

                // TODO: make this work with streams
                var out = new Buffer(4096);
                var err = new Buffer(4096);
                var ew = new EventWriter(out, err);

                var args = [TEST_SCRIPT_PATH];

                var inputConfiguration = utils.readFile(__filename, "../data/conf_with_2_inputs.xml");

                test.ok(!NewScript._service);

                NewScript.runScript(args, ew, inputConfiguration, function(err, scriptStatus) {
                    test.ok(!err);
                    test.strictEqual(0, ew.errPosition);
                    test.strictEqual(0, scriptStatus);
                    test.done();
                });                
            }
        }
    };
};

if (module === require.main) {
    var splunkjs    = require('../../index');
    var test        = require('../../contrib/nodeunit/test_reporter');

    var suite = exports.setup();
    test.run([{"Tests": suite}]);
}
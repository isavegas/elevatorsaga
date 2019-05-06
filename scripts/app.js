import { getCodeObjFromCode } from './base.js';
import { WorldController, WorldCreator } from './world.js';
import { Observable } from './observable.js';
import { challenges } from './challenges.js';
var createEditor = function () {
    var lsKey = "elevatorCrushCode_v5";
    var cm = CodeMirror.fromTextArea(document.getElementById("code"), {
        lineNumbers: true,
        indentUnit: 4,
        indentWithTabs: false,
        theme: "solarized light",
        mode: "javascript",
        // @ts-ignore
        autoCloseBrackets: true,
        extraKeys: {
            // the following Tab key mapping is from http://codemirror.net/doc/manual.html#keymaps
            Tab: function (cm) {
                var spaces = new Array(cm.getOption("indentUnit") + 1).join(" ");
                // @ts-ignore
                cm.replaceSelection(spaces);
            }
        }
    });
    // reindent on paste (adapted from https://github.com/ahuth/brackets-paste-and-indent/blob/master/main.js)
    cm.on("change", function (codeMirror, change) {
        if (change.origin !== "paste") {
            return;
        }
        var lineFrom = change.from.line;
        var lineTo = change.from.line + change.text.length;
        function reindentLines(codeMirror, lineFrom, lineTo) {
            codeMirror.operation(function () {
                codeMirror.eachLine(lineFrom, lineTo, function (lineHandle) {
                    codeMirror.indentLine(lineHandle.lineNo(), "smart");
                });
            });
        }
        reindentLines(codeMirror, lineFrom, lineTo);
    });
    var reset = function () {
        cm.setValue($("#default-elev-implementation").text().trim());
    };
    var saveCode = function () {
        localStorage.setItem(lsKey, cm.getValue());
        $("#save_message").text("Code saved " + new Date().toTimeString());
        codeEditorView.trigger("change");
    };
    var existingCode = localStorage.getItem(lsKey);
    if (existingCode) {
        cm.setValue(existingCode);
    }
    else {
        reset();
    }
    $("#button_save").click(function () {
        saveCode();
        cm.focus();
    });
    $("#button_reset").click(function () {
        if (confirm("Do you really want to reset to the default implementation?")) {
            localStorage.setItem("develevateBackupCode", cm.getValue());
            reset();
        }
        cm.focus();
    });
    $("#button_resetundo").click(function () {
        if (confirm("Do you want to bring back the code as before the last reset?")) {
            cm.setValue(localStorage.getItem("develevateBackupCode") || "");
        }
        cm.focus();
    });
    const autoSaver = _.debounce(saveCode, 1000);
    cm.on("change", function () {
        autoSaver();
    });
    class CodeEditorView extends Observable {
        constructor() {
            super();
            $("#button_apply").click(() => {
                this.trigger("apply_code");
            });
        }
        getCodeObj() {
            console.log("Getting code...");
            const codeStr = cm.getValue();
            return getCodeObjFromCode(codeStr);
        }
        setCode(code) {
            cm.setValue(code);
        }
        ;
        getCode() {
            return cm.getValue();
        }
        setDevTestCode() {
            cm.setValue($("#devtest-elev-implementation").text().trim());
        }
    }
    const codeEditorView = new CodeEditorView();
    return codeEditorView;
};
function createParamsUrl(current, overrides) {
    return "#" + _.map(_.merge(current, overrides), function (val, key) {
        return key + "=" + val;
    }).join(",");
}
;
function onPageLoad() {
    var tsKey = "elevatorTimeScale";
    var editor = createEditor();
    var params = {};
    var $world = $(".innerworld");
    var $stats = $(".statscontainer");
    var $feedback = $(".feedbackcontainer");
    var $challenge = $(".challenge");
    var $codestatus = $(".codestatus");
    // note: use of TypeScript non-null assertion operator
    var floorTempl = document.getElementById("floor-template").innerHTML.trim();
    var elevatorTempl = document.getElementById("elevator-template").innerHTML.trim();
    var elevatorButtonTempl = document.getElementById("elevatorbutton-template").innerHTML.trim();
    var userTempl = document.getElementById("user-template").innerHTML.trim();
    var challengeTempl = document.getElementById("challenge-template").innerHTML.trim();
    var feedbackTempl = document.getElementById("feedback-template").innerHTML.trim();
    var codeStatusTempl = document.getElementById("codestatus-template").innerHTML.trim();
    class ElevatorSagaApp extends Observable {
        constructor() {
            super();
            this.worldController = new WorldController(1.0 / 60.0);
            this.worldController.on("usercode_error", function (e) {
                console.log("World raised code error", e);
                editor.trigger("usercode_error", e);
            });
            console.log(this.worldController);
            this.worldCreator = new WorldCreator();
            this.world = undefined;
            this.currentChallengeIndex = 0;
            this.registerEditorEvents();
        }
        registerEditorEvents() {
            editor.on("apply_code", () => {
                this.startChallenge(this.currentChallengeIndex, true);
            });
            editor.on("code_success", () => {
                presentCodeStatus($codestatus, codeStatusTempl);
            });
            editor.on("usercode_error", (error) => {
                try {
                    if (error instanceof Error && error.stack) {
                        // Remove the auto-inserted Module. for the user code
                        error.stack = error.stack.replace(/at Module\./g, `at `);
                    }
                    presentCodeStatus($codestatus, codeStatusTempl, error);
                }
                catch (e) {
                    console.error('Error manipulating user-facing stacktrace!');
                    console.error(e);
                    presentCodeStatus($codestatus, codeStatusTempl, new Error("Internal game error."));
                }
            });
            editor.on("change", () => {
                $("#fitness_message").addClass("faded");
                var codeStr = editor.getCode();
                // fitnessSuite(codeStr, true, function(results) {
                //     var message = "";
                //     if(!results.error) {
                //         message = "Fitness avg wait times: " + _.map(results, function(r){ return r.options.description + ": " + r.result.avgWaitTime.toPrecision(3) + "s" }).join("&nbsp&nbsp&nbsp");
                //     } else {
                //         message = "Could not compute fitness due to error: " + results.error;
                //     }
                //     $("#fitness_message").html(message).removeClass("faded");
                // });
            });
            editor.trigger("change");
        }
        startStopOrRestart() {
            if (this.world.challengeEnded) {
                this.startChallenge(this.currentChallengeIndex);
            }
            else {
                this.worldController.setPaused(!this.worldController.isPaused);
            }
        }
        ;
        async startChallenge(challengeIndex, autoStart) {
            if (typeof this.world !== "undefined") {
                this.world.unWind();
                // TODO: Investigate if memory leaks happen here
            }
            this.currentChallengeIndex = challengeIndex;
            this.world = this.worldCreator.createWorld(challenges[challengeIndex].options);
            window.world = this.world;
            clearAll([$world, $feedback]);
            presentStats($stats, this.world);
            presentChallenge($challenge, challenges[challengeIndex], this, this.world, this.worldController, challengeIndex + 1, challengeTempl);
            presentWorld($world, this.world, floorTempl, elevatorTempl, elevatorButtonTempl, userTempl);
            this.worldController.on("timescale_changed", () => {
                localStorage.setItem(tsKey, app.worldController.timeScale.toString());
                presentChallenge($challenge, challenges[challengeIndex], this, this.world, this.worldController, challengeIndex + 1, challengeTempl);
            });
            this.world.on("stats_changed", () => {
                var challengeStatus = challenges[challengeIndex].condition.evaluate(this.world);
                if (challengeStatus !== null) {
                    this.world.challengeEnded = true;
                    this.worldController.setPaused(true);
                    if (challengeStatus) {
                        presentFeedback($feedback, feedbackTempl, this.world, "Success!", "Challenge completed", createParamsUrl(params, {
                            challenge: (challengeIndex + 2).toString()
                        }));
                    }
                    else {
                        presentFeedback($feedback, feedbackTempl, this.world, "Challenge failed", "Maybe your program needs an improvement?", "");
                    }
                }
            });
            try {
                const codeObj = await editor.getCodeObj();
                // This needs to be on the editor view...
                editor.trigger("code_success");
                console.log("Starting...");
                this.worldController.start(this.world, codeObj, window.requestAnimationFrame, autoStart);
            }
            catch (e) {
                // This needs to be on the editor view...
                editor.trigger("usercode_error", e);
            }
        }
        ;
    }
    //var app = riot.observable({}) as any;
    let app = new ElevatorSagaApp();
    riot.route((path) => {
        params = path.split(',').reduce((paramObj, pair) => {
            let match = pair.match(/(\w+)=(\w+$)/);
            if (match !== null) {
                let [whole, key, value] = match;
                paramObj[key] = value;
            }
            return paramObj;
        }, {});
        let requestedChallenge = 0;
        let autoStart = false;
        // if getItem(tsKey) returns null, parseFloat returns NaN (falsy) so timeScale = 2.0
        let timeScale = parseFloat(localStorage.getItem(tsKey)) || 2.0;
        for (let [key, val] of Object.entries(params)) {
            switch (key) {
                case "challenge":
                    requestedChallenge = _.parseInt(val) - 1;
                    if (requestedChallenge < 0 || requestedChallenge >= challenges.length) {
                        console.log("Invalid challenge index", requestedChallenge);
                        console.log("Defaulting to first challenge");
                        requestedChallenge = 0;
                    }
                    break;
                case "autostart":
                    // False by default, set to true if this key exists (and isn't `false`)
                    autoStart = val === "false" ? false : true;
                    break;
                case "timescale":
                    timeScale = parseFloat(val);
                    break;
                case "devtest":
                    editor.setDevTestCode();
                    break;
                case "fullscreen":
                    makeDemoFullscreen();
                    break;
            }
        }
        app.worldController.setTimeScale(timeScale);
        app.startChallenge(requestedChallenge, autoStart);
    });
}
$(onPageLoad);
//# sourceMappingURL=app.js.map
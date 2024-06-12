/* eslint-env node, gulp, es6 */
"use strict";
const  gulp = require("gulp");

console.log("Testing Gulp");

// var gulp = require("gulp"),
//     fs = require("fs"),
//     replace = require("gulp-replace"),
//     prompt = require("gulp-prompt"),
//     rename = require("gulp-rename"),
//     cmd = require("child_process"),
//     opn = require("opn"),
//     debug = require("debug"),
//     log = debug("logger:message*"),
//     logError = debug("logger:error*"),

//     housekeep = () => {
//         return new Promise((resolve) => {
//             cmd.exec("git gc --auto", (error, out, data) => {
//                 if (error) {
//                     log("Pushing upstream failed...");
//                     log("Error:", error);
//                 } else {
//                     log("Performing housekeeping tasks...");
//                     if (!!out) {
//                         log("Garbage Collector Output:\n", out);
//                     }
//                     if (!!data) {
//                         log("Garbage Collector Data:\n:", data);
//                     }
//                     resolve();
//                 }
//             });
//         });
//     },

//     promptBranch = () => {
//         var thisDebug = debug("gulp:prompt");
//         thisDebug("Arguments passed:", process.argv);
//         return new Promise((resolve) => {
//             //TODO: Fix needing this file twice https://github.com/Freyskeyd/gulp-prompt/issues/22
//             gulp.src(["package.json"]).pipe(prompt.prompt({
//                 type: "input",
//                 name: "branch",
//                 message: "Please enter your Branch Name"
//             }, function(res) {
//                 resolve(res.branch);
//             }));
//         });
//     },

//     getStatus = () => {
//         var thisDebug = debug("gulp:git:status");

//         return new Promise((resolve, reject) => {
//             cmd.exec("git status", (error, out) => {
//                 if (error) {
//                     log("Unable to retrieve git status...");
//                     logError("Error:", error);
//                     reject();
//                 } else {
//                     log("Successfully retrieved git status...");
//                     log("Status output:", out);
//                     thisDebug(out);
//                     resolve(out);
//                 }
//             });
//         });
//     },

//     commitChanges = (branchName) => {
//         var thisDebug = debug("gulp:git:status:commit");
//         return new Promise((resolve) => {
//             var getCount = ((status) => {
//                 var exp = new RegExp("by (\\d*)(?= commit)", "\g"),
//                     regExResult = exp.exec(status);

//                 return regExResult[1];
//             });

//             getStatus()
//                 .then((status) => {
//                     var curCount;
//                     thisDebug("Original status:", status);

//                     if (status.indexOf(`ahead of 'origin/${branchName.trim()}'`) >= 0) {
//                         curCount = getCount(status);
//                         thisDebug(`Ahead of remote 'origin/$branchName' by ${curCount} commit${(curCount > 1 ? "s" : "")}.`);
//                         resolve({
//                             "required": true,
//                             "count": getCount(status)
//                         });
//                     } else {
//                         thisDebug("Up to date");
//                         resolve({
//                             "required": false
//                         });
//                     }
//                 });
//         });
//     },

//     unstagedChanges = () => {
//         var thisDebug = debug("gulp:git:status:sanitized");
//         return new Promise((resolve) => {
//             getStatus()
//                 .then((status) => {
//                     thisDebug("Original status:", status);

//                     if (status.indexOf("Changes not staged for commit:") >= 0) {
//                         thisDebug("Unstaged changes present");
//                         resolve(true);
//                     } else {
//                         thisDebug("No unstaged changes present");
//                         resolve(false);
//                     }
//                 });
//         });
//     },

//     stashCurrentChanges = (branchName) => {
//         var thisDebug = debug("gulp:git:stash");
//         return new Promise((resolve, reject) => {
//             cmd.exec("git stash", (error, out) => {
//                 if (error) {
//                     log("Unable to stash changes...");
//                     logError("Error:", error);
//                     reject();
//                 } else {
//                     log("Successfully stashed changes...");
//                     thisDebug("output:", out);

//                     resolve(branchName);
//                 }
//             });
//         });
//     },
//     getCurrentBranch = () => {
//         var thisDebug = debug("gulp:git:branch:get");
//         return new Promise((resolve, reject) => {
//             cmd.exec("git rev-parse --abbrev-ref HEAD", (error, out) => {
//                 if (error) {
//                     log("Locating current branch failed...");
//                     logError("Error:", error);
//                     reject();
//                 } else {
//                     thisDebug("Returning current branch...");
//                     thisDebug("output:", out);
//                     resolve(out);
//                 }
//             });
//         });
//     },

//     pullMaster = () => {
//         var thisDebug = debug("gulp:git:branch:pull:master");
//         return new Promise((resolve, reject) => {
//             cmd.exec("git pull origin master", (error, out, data) => {
//                 if (error) {
//                     log("Pulling Master branch failed...");
//                     logError("Error:", error);
//                     reject();
//                 } else {
//                     log("Pulled from Master branch...");
//                     log("output:", out);
//                     thisDebug("Data", data);
//                     housekeep()
//                         .then(getCurrentBranch)
//                         .then(resolve);
//                 }
//             });
//         });
//     },

//     popStashedChanges = (branchName) => {
//         var thisDebug = debug("gulp:git:stash:pop");
//         return new Promise((resolve) => {
//             var pop = () => {
//                 return new Promise((resolve) => {
//                     cmd.exec("git stash pop", (error, out) => {
//                         if (error) {
//                             log("Unable to pop stashed changes...");
//                             logError("Error:", error);
//                         } else {
//                             log("Successfully popped stashed changes...");
//                             thisDebug("output:", out);

//                             resolve(branchName);
//                         }
//                     });
//                 });
//             };

//             pullMaster()
//                 .then(pop)
//                 .then(resolve);
//         });
//     },

//     checkoutBranch = (branchName) => {
//         var thisDebug = debug("gulp:git:branch:checkout");
//         return new Promise((resolve) => {
//             var branch = (branchName || "master");
//             thisDebug(`Checking out ${branch}`);
//             cmd.exec(`git checkout ${branch}`, (error, out, data) => {
//                 if (error) {
//                     log(`Checkout of ${branch} branch failed...`);
//                     thisDebug("Error:", error);
//                     log("\nContinuing from current branch. Some commits may be included");
//                 } else {
//                     log(`Checked out ${branch} branch...`);
//                     log("output:", out);
//                     thisDebug("Data", data);
//                 }

//                 resolve(branchName);
//             });
//         });
//     },

//     stashCheckout = (branchName) => {
//         var thisDebug = debug("gulp:git:stash:checkout");
//         return new Promise((resolve) => {
//             thisDebug("Stashing changes before checkout...");
//             stashCurrentChanges(branchName)
//                 .then(checkoutBranch)
//                 .then(resolve);
//         });
//     },




//     pushCurrentCommits = (current, branchName) => {
//         var thisDebug = debug("gulp:git:branch:push");
//         return new Promise((resolve, reject) => {
//             thisDebug("Pushing commits...");
//             cmd.exec(`git push -u origin ${current}`, (error, out, data) => {
//                 if (error) {
//                     log("Pushing commits failed...");
//                     log("Error:", error);
//                     reject();
//                 } else {
//                     log("Successfully pushed commits...");
//                     thisDebug("Output:", out);
//                     log("Data:", data);
//                     resolve(branchName);
//                 }
//             });
//         });
//     },

//     createNewBranch = (branchName) => {
//         var thisDebug = debug("gulp:git:branch:create:new");
//         return new Promise((resolve, reject) => {
//             cmd.exec(`git checkout -b ${branchName}`, (error, out, data) => {
//                 if (error) {
//                     log("Creating branch failed...");
//                     log("Error:", error);
//                     reject();
//                 } else {
//                     log(`Created Branch ${branchName}...`);
//                     thisDebug("output:", out);
//                     log("Data", data);
//                     resolve(branchName);
//                 }
//             });
//         });
//     },

//     promptStash = (branchName, newBranch, callback) => {
//         var thisDebug = debug("gulp:git:prompt:stash"),
//             nextFunc = () => {
//                 if (typeof callback === "function") {
//                     return new Promise((resolve) => {
//                         thisDebug("Executing callback", callback);
//                         callback(newBranch)
//                             .then(resolve);
//                     });
//                 } else {
//                     return new Promise((resolve, reject) => {
//                         thisDebug("No callback provided for promptStash...");
//                         reject(branchName);
//                     });
//                 }
//             };
//         return new Promise((resolve) => {

//             var toStash = () => {
//                     return new Promise((resolve) => {
//                         unstagedChanges()
//                             .then((stashRequired) => {
//                                 if (!stashRequired) {
//                                     thisDebug("No stashing is currently required. Continuing...");
//                                     nextFunc(branchName)
//                                         .then(resolve);
//                                 } else {
//                                     thisDebug("Uncommited changes identified. Prompting...");
//                                     gulp.src(["package.json"])
//                                         .pipe(prompt.prompt({
//                                             "type": "list",
//                                             "name": "selection",
//                                             "message": "Current changes will be stashed\n How would you like to continue?",
//                                             "choices": ["Stash Only", "Stash and Pop", "Cancel"],
//                                             "pageSize": 2
//                                         }, function(res) {
//                                             var actions = {
//                                                 "Stash Only": () => {
//                                                     thisDebug("Stash only selected");
//                                                     stashCheckout(branchName)
//                                                         .then(nextFunc)
//                                                         .then(resolve);
//                                                 },
//                                                 "Stash and Pop": () => {
//                                                     thisDebug("Stash and Pop selected");
//                                                     stashCheckout(branchName)
//                                                         .then(nextFunc)
//                                                         .then(popStashedChanges)
//                                                         .then(resolve);
//                                                 },
//                                                 "Cancel": () => {
//                                                     thisDebug("Cancel selected");
//                                                     log("Cancelled changes");
//                                                 }
//                                             };

//                                             thisDebug("Selection:", res.selection);
//                                             if (actions.hasOwnProperty(res.selection)) {
//                                                 actions[res.selection]();
//                                             } else {
//                                                 log("Rejected changes");
//                                             }
//                                         }));
//                                 }
//                             });
//                     });
//                 },
//                 toCommit = () => {
//                     return new Promise((resolve, reject) => {
//                         getCurrentBranch()
//                             .then((curBranch) => {
//                                 commitChanges(branchName)
//                                     .then((commit) => {
//                                         thisDebug("Commit Required:", commit.required);

//                                         if (!commit.required) {
//                                             resolve(branchName);
//                                         } else {
//                                             gulp.src(["package.json"])
//                                                 .pipe(prompt.prompt({
//                                                     "type": "list",
//                                                     "name": "selection",
//                                                     "message": `WARNING:\n ${curBranch.trim()} is ahead of remote by ${commit.count} commit${(commit.count > 1 ? "s" : "")} \n You may want to push ${curBranch.trim()} first...\n How would you like to continue?`,
//                                                     "choices": ["Push", "Continue As Is", "Cancel"],
//                                                     "pageSize": 3
//                                                 }, function(res) {
//                                                     var actions = {
//                                                         "Push": () => {
//                                                             thisDebug("Push selected");
//                                                             pushCurrentCommits(curBranch, branchName)
//                                                                 .then(resolve);
//                                                         },
//                                                         "Continue As Is": () => {
//                                                             thisDebug("Continue As Is selected");
//                                                             resolve();
//                                                         },
//                                                         "Cancel": () => {
//                                                             thisDebug("Cancel selected");
//                                                             log("Cancelled changes");
//                                                         }
//                                                     };

//                                                     thisDebug("Selection:", res.selection);
//                                                     if (actions.hasOwnProperty(res.selection)) {
//                                                         actions[res.selection]();
//                                                     } else {
//                                                         reject();
//                                                     }
//                                                 }));
//                                         }
//                                     });
//                             });
//                     });
//                 };

//             toCommit()
//                 .then(toStash)
//                 .then(resolve);
//         });
//     },



//     createBranch = (branchName) => {
//         var thisDebug = debug("gulp:git:branch:create");
//         return new Promise((resolve) => {
//             var knownBranches = () => {
//                     return new Promise((resolve, reject) => {
//                         cmd.exec("git branch", (error, out) => {
//                             if (error) {
//                                 log("Unable to retrieve known branches...");
//                                 thisDebug("Error:", error);
//                                 reject();
//                             } else {
//                                 log("Retrieved known branches...");
//                                 thisDebug("output:", out);
//                                 resolve(out);
//                             }
//                         });
//                     });
//                 },

//                 checkBranch = (curBranch) => {
//                     return new Promise((resolve) => {
//                         knownBranches()
//                             .then((known) => {
//                                 if (known.indexOf(branchName) < 0) {
//                                     thisDebug("Branch unknown, creating...");
//                                     promptStash(curBranch, branchName, createNewBranch)
//                                         .then(resolve);
//                                 } else {
//                                     thisDebug("Branch known, checkout...");
//                                     promptStash(curBranch, branchName, checkoutBranch)
//                                         .then(resolve);
//                                 }
//                             });
//                     });
//                 };

//             getCurrentBranch()
//                 .then((current) => {
//                     if (branchName === current) {
//                         resolve(branchName);
//                     } else {
//                         checkBranch(current)
//                             .then(resolve);
//                     }
//                 });
//         });
//     },
//     createPullRequest = (branchName) => {
//         var thisDebug = debug("gulp:git:branch:pull:request");
//         return new Promise((resolve, reject) => {
//             var snatchUrl = (input) => {
//                     var branchBased = (function() {
//                             var check = new RegExp(`(http)(.*)(${branchName.trim()})`, "g");

//                             return (input.match(check) && input.match(check)[0] || false);
//                         }()),
//                         numberBased = (function() {
//                             var check = new RegExp("(http)(.*)(\\d)", "g");

//                             return (input.match(check) && input.match(check)[0] || false);
//                         }());

//                     return (branchBased || numberBased);
//                 },

//                 checkPull = (input) => {
//                     var check = new RegExp("Everything up-to-date", "g"),
//                         pullRequestCreated = !input.match(check);

//                     if (pullRequestCreated) {
//                         const pullUrl = snatchUrl(input);
//                         log("Launching pull request located at:", pullUrl, "...");
//                         opn(pullUrl, { wait: false });
//                     } else {
//                         log("Branch up to date; No pull request created");
//                     }
//                 };

//             cmd.exec(`git push -u origin ${branchName}`, (error, out, data) => {
//                 if (error) {
//                     log("Pushing upstream failed...");
//                     log("Error:", error);
//                     reject();
//                 } else {
//                     const pullUrl = snatchUrl(data);
//                     log("Successfully pushed upstream...");
//                     thisDebug("Output:", out);
//                     log("Data:", data);
//                     checkPull(data);
//                     resolve(branchName);
//                 }
//             });
//         });
//     };

// gulp.task("createPullRequest", function() {
//     var thisDebug = debug("gulp:task:createPullRequest");
//     getCurrentBranch().then((branchName) => {
//         if (branchName !== "master") {
//             pullMaster().then(
//                 createPullRequest(branchName)
//             );
//         } else {
//             thisDebug("Unable to create pull request from branch Master");
//             promptBranch()
//                 .then(checkoutBranch)
//                 .then(pullMaster)
//                 .then(createPullRequest);
//         }
//     });
// });

// gulp.task("createBranch", () => {
//     promptBranch()
//         .then(createBranch)
//         .then(pullMaster);
// });

// gulp.task("pullMaster", () => {
//     pullMaster();
// });

// gulp.task("prune", () => {
//     var executePrune = () => {
//         housekeep();
//     };

//     pullMaster()
//         .then(executePrune);

// });
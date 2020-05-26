app.service("api", function($q, googleAuth, utils) {
    let service = {};

    service.getMessages = function(pageToken) {
        let defer = $q.defer();
        var request = gapi.client.gmail.users.messages.list({
            'userId': 'me',
            'pageToken' : pageToken,
            'maxResults' : 100
        });
        request.then(function(response) {
            defer.resolve(response.result);
        }, function(reason) {
            console.log('Error: ', reason);

            if (reason.status === 429) {
                setTimeout(function() {
                    defer.reject("too fast");
                }, 1000)
            } else {
                googleAuth.reloadAuth().then(function(authToken) { // we do not need it actually, but it happens to be the auth token
                    defer.reject(authToken);
                })
            }
        });
        return defer.promise;
    }

    // Metadata only (for counting how many emails)
    service.getMessage = function(id) {
        let defer = $q.defer();
        var request = gapi.client.gmail.users.messages.get({
            'userId': 'me',
            'id' : id,
            'format' : 'metadata',
            'metadataHeaders': ['To', 'From'] // skipping 'Cc', 'Bcc' for now, would be more complicated to interpret
        });
        request.then(function(response) {
            defer.resolve(response.result);
        }, function(reason) {
            console.log('Error: ', reason);

            if (reason.status === 429) {
                setTimeout(function() {
                    defer.reject("too fast");
                }, 1000)
            } else {
                googleAuth.reloadAuth().then(function(authToken) { // we do not need it actually, but it happens to be the auth token
                    defer.reject(authToken);
                })
            }

        });
        return defer.promise;
    }

    // For displaying preview
    service.getMessageFull = function(id) {
        let defer = $q.defer();
        var request = gapi.client.gmail.users.messages.get({
            'userId': 'me',
            'id' : id,
            'format' : 'full',
        });
        request.then(function(response) {
            defer.resolve(response.result);
        }, function(reason) {
            console.log('Error: ', reason);

            if (reason.status === 429) {
                setTimeout(function() {
                    defer.reject("too fast");
                }, 1000)
            } else {
                googleAuth.reloadAuth().then(function(authToken) { // we do not need it actually, but it happens to be the auth token
                    defer.reject(authToken);
                })
            }

        });
        return defer.promise;
    }

    // when clicking on the "info" we will retrieve more info about that particular user
    // toORfrom: this will help further down the line to display 5 TO and 5 FROM messages
    service.getEmail = function(email, sender) {
        let defer = $q.defer();

        let searchQuery = sender && sender.to ? `to: ${email}` : `from: ${email}`;

        var request = gapi.client.gmail.users.messages.list({
            'userId': 'me',
            'maxResults' : 5,
            'q' : searchQuery
        });
        request.then(function(response) {
            defer.resolve(response.result);
        }, function(reason) {
            console.log('Error: ', reason);

            if (reason.status === 429) {
                setTimeout(function() {
                    defer.reject("too fast");
                }, 1000)
            } else {
                googleAuth.reloadAuth().then(function(authToken) { // we do not need it actually, but it happens to be the auth token
                    defer.reject(authToken);
                })
            }
        });
        return defer.promise;       
    }

    service.sendEmail = function(params) {
        let defer = $q.defer();
        var request = gapi.client.gmail.users.messages.send({
            'userId': 'me',
            'raw': utils.base64(utils.createEmailString(params))
        });
        request.then(function(response) {
            defer.resolve(response.result);
        }, function(reason) {
            console.log('Error: ', reason);
            defer.reject(reason);
        });
        return defer.promise;
    }

    return service;
})

app.service("analyse", function($q) {
    let service = {};
    let data = {};
    let chatCount = 0;

    // same emailRegEx, must be good!
    // https://stackoverflow.com/questions/14440444/extract-all-email-addresses-from-bulk-text-using-jquery
    // https://stackoverflow.com/questions/42407785/regex-extract-email-from-strings
    let emailRegEx = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi; 

    service.processMessage = function(response) {

        try {
            if (response.error) {
                console.error(reponse.error);
                debugger;
                return;
            }

            if (!response.payload.headers) {
                if (response.labelIds.indexOf("CHAT") !== -1) {
                    chatCount++;
                    if (chatCount % 10 === 0) console.log(`${chatCount} chat messages`);
                } else {
                    console.error("Something weird. Message with no headers that is not CHAT");
                    console.log(payload);
                }

                return;
            }

            response.payload.headers.forEach(function(header) {
                let matches = header.value.match(emailRegEx);

                if (!matches) { // no email found the header (undisclosed-recipients)
                    return; 
                }

                matches.forEach(function(match) {
                    let emailLowercase = match.toLowerCase();
                    if (! data[emailLowercase]) { // if email is seen for the first time then initialising the data
                        data[emailLowercase] = { "to": 0, "from" : 0 };
                    }
                    data[emailLowercase][header.name.toLowerCase()]++;
                });
            });
        } catch (err) {
            console.error(err);
            debugger;
        }

    }

    const blacklist = ["@meetup.com", "seclists.org"];
    function _isBlacklisted(email) {
        for (let i=0; i<blacklist.length; i++) {
            if (email.endsWith(blacklist[i])) {
                return true;
            }
        }
        return false;
    }

    service.processEmailData = function() {
        let returned = [];

        Object.keys(data).forEach(function(key) {
            if (_isBlacklisted(key)) {
                return;
            }
            let ed = data[key]; // ed = Email Data
            if (ed.to > 0 || ed.from > 0) { // skipping Cc Bcc
                returned.push({ 
                    email: key, 
                    to: ed.to, 
                    from: ed.from, 
                    min: Math.min(ed.to, ed.from), 
                    sum: ed.to + ed.from,
                    category: ed.category
                });
            }
        })
        
        return returned;
    }

    service.getData = function() {
        return data;
    }

    service.setData = function(dataNew) {
        data = dataNew;
    }

    service.setCategory = function(email, category) {
        data[email].category = category;
    }

    window.analyseService = service; // DEBUGGING
    return service;
})

// TODO: resuming from the place we stopped, not fetching new messages (too complicated for now)
// TODO: client size ZIP to stay within 5MB quota
// TODO: onbeforeunload?
app.service("storage", function() {
    let service = {}

    service.saveAll = function(scope) {
        service.save("messageIDs", scope.messageIDs);
        service.save("dataRaw", scope.dataRaw);
        service.save("messagesRetrievedTotal", scope.messagesRetrievedTotal);
        service.save("messagesProcessedCount", scope.messagesProcessedCount);
        service.save("nextPageToken", scope.nextPageToken);
    }

    service.loadAll = function() {
        return {
            messageIDs : service.load("messageIDs"),
            dataRaw : service.load("dataRaw"),
            messagesRetrievedTotal : service.load("messagesRetrievedTotal"),
            messagesProcessedCount : service.load("messagesProcessedCount"),
            nextPageToken : service.load("nextPageToken"),
        }
    }

    service.save = function(name, data) {
        localStorage.setItem(name, JSON.stringify(data))
    }

    service.load = function(name) {
        return JSON.parse(localStorage.getItem(name));
    }

    service.download = function(emails) {
        var emailsString = emails.map(function(item) { return item.email; }).join("\n");
        var blob = new Blob([emailsString], {type: "text/plain;charset=utf-8"});
        saveAs(blob, "emails___" + new Date().toISOString() + ".csv"); // library FileSaver
    };  

    window.storageService = service; // DEBUGGING
    return service;
})

app.service("payments", function($http, $q) {
    let service = {}

    const ENDPOINT = "/"; // same server --> TODO: use GCP

    service.paid = function(email) {
        // return $http({
        //     method: "POST",
        //     url: ENDPOINT + "paid",
        //     params: { email : email }
        // });

        let defer = $q.defer()
        defer.resolve();
        return defer.promise;
    }

    service.check = function(email) {
        // return $http({
        //     method: "GET",
        //     url: ENDPOINT + "check",
        //     params: { email : email }
        // });

        let defer = $q.defer()
        defer.resolve({ data:true });
        return defer.promise;
    }

    return service;
});

app.service("utils", function() {
    let service = {}

    service.base64 = function(text) { 
        // URL safe encoding: https://en.wikipedia.org/wiki/Base64
        return btoa(text).replace(/\+/g, '-').replace(/\//g, '_')
    };
      
    service.createEmailString = function(params) {
        return "To: " + params.to + "\n" +
            "Subject: " + params.subject + "\n" +
            "\n" +
            params.body;
    };

    return service;
})
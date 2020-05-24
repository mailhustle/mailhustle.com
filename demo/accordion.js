// HACK HACK HACK HACK HACK - how to ensure that both Angular and Google API are loaded?
bothAngularAndGoogleLoadedCount = 0;
function bothAngularAndGoogleLoaded() {
  bothAngularAndGoogleLoadedCount++;
  if (bothAngularAndGoogleLoadedCount === 2) {
    window.handleClientLoad();
  }
}

app = angular.module('app', ['ui.bootstrap', 'ngSanitize']);

app.run(function(googleAuth) {
  // making the code available globally
  // https://stackoverflow.com/questions/16709373/angularjs-how-to-call-controller-function-from-outside-of-controller-component
  window.handleClientLoad = googleAuth.handleClientLoad;
  bothAngularAndGoogleLoaded();
});

app.controller('AccordionDemoCtrl', function ($rootScope, $scope, $filter, googleAuth, $interval, api, analyse, storage, payments) {
  $scope.premium = function() {
    $('#myModal').modal('show');
  }

  paypal.Buttons({
    createOrder: function(data, actions) {
      // This function sets up the details of the transaction, including the amount and line item details.
      return actions.order.create({
        purchase_units: [{
          amount: {
            value: '0.01'
          }
        }],
        email: "testing-paypal@gmail.com" // Will have to create button afterwars (upon login)
      });
    },
    onApprove: function(data, actions) {
      // This function captures the funds from the transaction.
      return actions.order.capture().then(function(details) {
        // This function shows a transaction success message to your buyer.

        console.log(details);

        alert('Transaction completed by ' + details.payer.name.given_name);

        // HACK HACK HACK HACK
        // it is not really a security check
        // the code is (will be) open-source
        // you are paying for the convenience
        payments.paid($scope.email);
        $scope.paid = true;
        $('#myModal').modal('hide');
      });
    }
  }).render('#paypal-container');

  $scope.status = [
    {open: true, disabled: false},
    {open: true, disabled: false},
    {open: false, disabled: true },
    {open: false, disabled: true },
    {open: false, disabled: true },
    {open: false, disabled: true },
  ];

  ////////// PAGINATION AND CATEGORIES
  $scope.category = 'all'; // by default we show everything
  $scope.pagination = {
    currentPage: 1,
    maxSize: 25,
  };

  $scope.filterCategory = function(category) {
    if (category) { // setting only if not null
      $scope.category = category;
    }
    
    if ($scope.category === 'all') {
      $scope.dataFiltered = $scope.dataBoth;
    } else if ($scope.category === 'uncategorized') {
      $scope.dataFiltered = $scope.dataBoth.filter(item => !item.category);
    } else {
      $scope.dataFiltered = $scope.dataBoth.filter(item => item.category === $scope.category)
    }

    $scope.pagination.totalItems = Math.ceil($scope.dataFiltered.length / $scope.pagination.maxSize) * 10; // HACK (related to paging issue)
    $scope.pageChanged();
  }

  $scope.pageChanged = function() {
    //console.log('Page changed to: ' + $scope.pagination.currentPage);
    $scope.dataBothPaged = $scope.dataFiltered.slice(($scope.pagination.currentPage - 1)  * $scope.pagination.maxSize, ($scope.pagination.currentPage - 1)  * $scope.pagination.maxSize + $scope.pagination.maxSize)
  };

  _resetData();

  _initData();

  $rootScope.$on("auth", function() {
    console.log("$rootScope.$on('auth'): " + $rootScope.auth);

    if ($rootScope.auth === true) {
      $scope.email = googleAuth.getEmail();
      $scope.status[2] = { open: true, disabled: false }; // forcing open on login
      $scope.status[3].disabled = false;
      $scope.status[4].disabled = false;
      $scope.status[5].disabled = false;

      payments.check($scope.email).then(function(actual) {
        console.log("payments.check: " + actual.data);
        $scope.paid = actual.data;
      })
    } else {
      $scope.email = null; // for some reason, event when not logged in the `googleAuth.getEmail()` remains set to the previous value
      $scope.status[2] = {open: false, disabled: true };
      $scope.status[3] = {open: false, disabled: true };
      $scope.status[4] = {open: false, disabled: true };
      $scope.status[5] = {open: false, disabled: true };
    } 
    $scope.$apply();
  })

  // DEBUG DEBUG DEBUG DEBUG
  $scope.getGoogleAuth = function() {
    window.googleAuth = googleAuth; // getting the reference to the service
    console.log(googleAuth);
    return googleAuth;
  }

  $scope.signIn = function() {
    googleAuth.signIn();
  }

  $scope.signOut = function() {
    googleAuth.signOut();
    _resetData();
    localStorage.clear();
  }

  $scope.disconnect = function() {
    googleAuth.disconnect();
    _resetData();
    localStorage.clear();
  }

  $scope.checkPaid = function() {
    payments.check($scope.email).then(function(actual) {
      console.log("payments check: ", actual);
    })
  }
  $scope.pay = function() {
    payments.paid($scope.email).then(function(actual) {
      console.log("pay: ", actual);
    })
  }

  $scope.started = false;
  $scope.startpause = function() {
    if (! $scope.started) {
      $scope.getMessages(); // TODO: fix a tiny delay (pressing the button and actual doing) 
    } else {
      $scope.kill();
    }
  }

  $scope.kill = function() {
      $scope.killswitch = true;
      $scope.started = false;
      $interval.cancel(intervalId);
      storage.saveAll($scope); // this is because when resuming and reloading we want the same
  }
  let intervalId;

  $showSingle = false;

  $scope.getMessages = function() {
    $scope.killswitch = false;
    $scope.status[3] = { open: true };
    $scope.dateStart = new Date();
    _getMessages($scope.nextPageToken);

    // UI updates every second, otherwise too heavy for AngularJS to update every new message
    intervalId = $interval(function() {
        $scope.data = analyse.processEmailData();
        $scope.dataRaw = analyse.getData(); // it is used for saving and retrieving
        $scope.dataBoth = $filter('orderBy')($scope.data.filter(item => item.min), ['-min', '-sum']);
        $scope.dataNope = $scope.data.filter(item => !item.min);
        $scope.filterCategory(); // this is required otherwise initially nothing is showing
        storage.saveAll($scope);
    }, 1000)

  }

  $scope.download = function() {
      storage.download($scope.paid ? $scope.dataBoth : $scope.dataBoth.slice(0,20));
  }

  function _resetData() {
    $scope.email = "";
    $scope.paid = "";
    $scope.messageIDs = [];
    $scope.nextPageToken = null;
    $scope.messagesRetrievedTotal = 0;
    $scope.messagesProcessedCount = 0;
    $scope.killswitch = false;
    $scope.dateStart = 0;
    $scope.dateNow = 0;
  }

  function _initData() {
    let fromLocalStorage = storage.loadAll();
    $scope.messageIDs = fromLocalStorage.messageIDs || [];

    if (fromLocalStorage.dataRaw) { // if we have stuff in local storage, then we set it and then analyse
      $scope.dataRaw = fromLocalStorage.dataRaw; // in case we are analysing, we save to local storage, we need to preserve that
      analyse.setData(fromLocalStorage.dataRaw);
      $scope.data = analyse.processEmailData();
      $scope.dataBoth = $filter('orderBy')($scope.data.filter(item => item.min), ['-min', '-sum']);
      $scope.filterCategory('all');
      $scope.pagination.totalItems = Math.ceil($scope.dataBoth.length / $scope.pagination.maxSize) * 10; // HACK (related to paging issue)
      $scope.pageChanged();
       // we have both data, now kicking off the paging
      $scope.dataNope = $scope.data.filter(item => !item.min);
      $scope.status[3] = { open: true };
    }

    $scope.messagesRetrievedTotal = fromLocalStorage.messagesRetrievedTotal
    $scope.messagesProcessedCount = fromLocalStorage.messagesProcessedCount
    $scope.nextPageToken = fromLocalStorage.nextPageToken
  }

  function _processMessage(response) {
    analyse.processMessage(response);
    $scope.messagesProcessedCount++;
  }

  function _getMessage() {
    if ($scope.killswitch) return;

    $scope.dateNow = new Date();
    $scope.dateInMinutes = moment.duration( moment($scope.dateNow).diff($scope.dateStart) ).asMinutes();
    $scope.dateInSeconds = moment.duration( moment($scope.dateNow).diff($scope.dateStart) ).asSeconds();

    // let id = $scope.messageIDs.pop() 
    // now taking randomly (old or new, more chances of finding a variety of emails)
    let id = $scope.messageIDs.splice(Math.floor(Math.random() * $scope.messageIDs.length), 1)[0];

    if (!id) {
      _jobDone();
    };

    api.getMessage(id).then(function(response) {
        _processMessage(response);
        _getMessage();
    }, function(rejected) { // this shoudl happen after reloadign the auth

      api.getMessage(id).then(function(response) {
        _processMessage(response);
        _getMessage();
      });

    });
  }

  function _getMessages(pageToken) {
    if ($scope.killswitch) return;

    api.getMessages(pageToken).then(function(response) {
      let messageIDs = response.messages.map(message => message.id);
      $scope.messagesRetrievedTotal += messageIDs.length;
      $scope.messageIDs = $scope.messageIDs.concat(messageIDs);
      
      if(response.nextPageToken) { // continue with getMessages only if there is token
        $scope.nextPageToken = response.nextPageToken; // this is because we periodically save data to the local storage and preserving this piece of information
        _getMessages(response.nextPageToken); 
      }

      if (! $scope.started && !$scope.killswitch) { // I know killswitch is duplicated but as you press pause, some web requests might be ongoing 
        $scope.started = true; 
          _getMessage();
          _getMessage();
          _getMessage();
          _getMessage();
          _getMessage();
          _getMessage();
      }
    }, function(rejected) {
      console.error("was rejected, why not try out again");
      debugger;
    });
  }

  let jobDone = false; //
  function _jobDone() {
    if (!jobDone) {
      $scope.status[3] = { open: true };
      alert("Job done! Check the results");
    }
    jobDone = true;
  }

  ///////////////////// NEW FEATURE USER DETAILS ////////////////////////

  $scope.emailDetails = {};
  $scope.currentIndex;
  $scope.currentEmail;

  window.emailDetails = $scope.emailDetails; // REMOVE (for debugging)

  let _preserveOrder; // this is required so that Prev / Next will not loop in case of change in the order
  $('#myModalEmailDetail').on('hidden.bs.modal', function () {
    _preserveOrder = undefined; // once we closed, we don't need to prerve order within modal
  });

  $scope.userInfo = function(index) {
    if (!_preserveOrder) {
      _preserveOrder = $scope.dataFiltered.map(x => x.email);
    }
    
    $scope.currentIndex = index;
    let email = $scope.currentEmail = $scope.dataFiltered[index].email;

    $('#myModalEmailDetail').modal('show');

    let noToMessages;
    let noFromMessages;

    if (! $scope.emailDetails[email]) { // otherwise we have and can display directly
      $scope.emailDetails[email] = [];
      api.getEmail(email, {to: true}).then(function(response) {
        if (! response.messages) { noToMessages = true; return}
    
        for (let i=0; i<response.messages.length; i++) {
          api.getMessageFull(response.messages[i].id).then(function(message) {
            $scope.emailDetails[email].push({
              snippet: message.snippet,
              date: new Date(+message.internalDate),
              to: true,
            });
          })
        }
      })

      api.getEmail(email).then(function(response) {
        if (! response.messages) { noFromMessages = true; return}
    
        for (let i=0; i<response.messages.length; i++) {
          api.getMessageFull(response.messages[i].id).then(function(message) {
            $scope.emailDetails[email].push({
              snippet: message.snippet,
              date: new Date(+message.internalDate),
            });
          })
        }
      })
    }

    if (noToMessages && noFromMessages) { alert("something weird, that email has not a single message, really weird: " + email); }
  }

  $scope.userPrev = function() {
    $scope.userInfo(--$scope.currentIndex)
  }

  $scope.userNext = function() {
    $scope.userInfo(++$scope.currentIndex)
  }

  $scope.setCategory = function(email, category) {
    analyse.setCategory(email, category); // saving the single source of truth automatically
    
    let guy = _.findWhere($scope.dataBoth, {email: email});
    if ( guy.category === category) {
      guy.category = undefined; // unselecting
    } else {
      guy.category = category;
    }

    storage.saveAll($scope); // normally save happens every 1 second. When analysing offline, do this on each action.
  }

  $scope.moveNext = function() {
    // moving to the next one automatically
    if ($scope.currentIndex === $scope.dataBoth.length - 1) { // the last one, SIMPLIFYING (not rewinding to the beginning)
        $('#myModalEmailDetail').modal('hide');
        alert("No more users");
    } else {
      $scope.userNext();
    }
  }

  /////////////////////

  $scope.newEmail = {
    to: "email@genesis.re", // testing override
    subject: "new subject",
    body: "some body"
  }

  $scope.hasPermission = false;

  $scope.elevatePermission = function() {
    googleAuth.elevatePermission()
  }

  $scope.sendEmail = function() {
    console.log("sending Email --> not implement yet --> permissions", $scope.newEmail);

    api.sendEmail($scope.newEmail);
  }


});
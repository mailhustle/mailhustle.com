app.service('googleAuth', function($rootScope, $q) {
    let service = {};
    var GoogleAuth;
    var SCOPE_BASIC = 'https://www.googleapis.com/auth/gmail.readonly';
    var SCOPE_SEND = 'https://www.googleapis.com/auth/gmail.send';
    service.handleClientLoad = function() {
      gapi.load('client:auth2', initClient);
    }
  
    function signStatusChanged(status) {
      console.log("signStatusChanged: " + status);
      $rootScope.auth = status;
      $rootScope.$broadcast("auth");
    }
  
    function initClient() {
      var discoveryUrl = ['https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest'];
  
      gapi.client.init({
          'apiKey': 'AIzaSyC-dnzsKNQ2wH0Zug8XRZcQGZ8q8t8G3Ww',
          'discoveryDocs': discoveryUrl,
          'clientId': '264905779599-7qqrss1klp9e0maebcq4hrdvah624fov.apps.googleusercontent.com',
          'scope': SCOPE_BASIC
      }).then(function () {
        GoogleAuth = gapi.auth2.getAuthInstance();    
        GoogleAuth.isSignedIn.listen(signStatusChanged);    
  
        service.getSignStatus();
      });
    }
  
    service.signIn = function() {
      return GoogleAuth.signIn();
    }
  
    service.signOut = function() {
      return GoogleAuth.signOut();
    }
  
    service.disconnect = function() {
      return GoogleAuth.disconnect();
    }

    // FOR DEBUGGING, GOING DEEPER, CAN RETRIEVE THE OBJECT
    service.getGoogleAuth = function() {
      return GoogleAuth; 
    }

    service.reloadAuth = function() {
      let defer = $q.defer();
      GoogleAuth.currentUser.get().reloadAuthResponse().then(function(something) {
        console.log(something);
        defer.resolve(something);
      });
      return defer.promise;
    }
  
    service.getSignStatus = function() {
      var user = GoogleAuth.currentUser.get();
      var signedIn = user.hasGrantedScopes(SCOPE_BASIC);
      $rootScope.auth = signedIn;
      $rootScope.$broadcast("auth");
      console.log("getSignStatus: " + signedIn);
      return signedIn;
    }

    service.getEmail = function() {
      try {
        return GoogleAuth.currentUser.get().getBasicProfile().getEmail()
      } catch {
        return null; // if not authorized surely it will throw on the line above
      }
    }

    //////// ELEVATE PERMISSIONS

    service.elevatePermission = function() {
      let options = new gapi.auth2.SigninOptionsBuilder({ 'scope': SCOPE_SEND });

      var user = GoogleAuth.currentUser.get();

      user.grant(options).then(
        function(success){
          console.log(JSON.stringify({message: "success", value: success}));
        },
        function(fail){
          alert(JSON.stringify({message: "fail", value: fail}));
        });
    }

    service.hasElevatedPermission = function() {
      var user = GoogleAuth.currentUser.get();
      var elevated = user.hasGrantedScopes(SCOPE_SEND);
      console.log("Checking for elevated permissions: " + elevated);
      return elevated;
    }
  
    return service;
})
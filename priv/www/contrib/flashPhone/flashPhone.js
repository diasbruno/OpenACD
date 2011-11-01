/**
Create a new flashPhone.  Wraps the flash player object and sets up eventing
for use with FreeSWITCH's mod_rtmp.  This is dependant on the swfobject lib.
@param {String} rtmpUrl Url of the FreeSWITCH instance running mod_rtmp.
@param {String} parentNode Node Id that will be replaced by the flash 
	object.
@param {Object} [OtherArgs] Addtional options.
@param {Boolean} [OtherArgs.suppressRingSound] If true, the phone will not 
	play the embedded ring sound.  Defaults to true.
@param {String} [OtherArgs.pathToFreeswitchSwf] If the freeswitch.swf 
	doesn't live in the same directory as the page that uses the flashphone,
	it might be a good idea to set this.
@param {Function} [OtherArgs.onInit] Function to use for event handling of
	the onInit event.
@param {Function} [OtherArgs.onConnected] Function to use for event handling
	of the onConnected event.
@param {Function} [OtherArgs.onDebug] Function to use for event handling of
	the onDebug event.
@class Wrapper for the flash object.  Makes it a bit easier to handle 
	answering, hanging up, and calling.
*/
flashPhone = function(rtmpUrl, parentNode, OtherArgs){
	if(!window.swfobject){
		throw new Error('missing swfobject lib');
	}

	// Make the global callbacks by flash into events.
	this.eventNames = ["onConnected", "onHangup", "onLogin", 
		"onLogout", "onAttach", "onMakeCall", "onCallState", "onDisplayUpdate", 
		"onIncomingCall", "onEvent", "onDebug", "onInit", "onDisconnected"];
	for(var i = 0; i < this.eventNames.length; i++){
		if(window[this.eventNames[i]]){
			throw new Error(this.eventNames[i] + ' already defined');
		}
		(function(callbackName, thePhone){
			window[callbackName] = function(){
				var evt = flashPhone.createEvent(callbackName, arguments);
				thePhone.flashObject.dispatchEvent(evt);
				if(callbackName == "onConnected"){
					thePhone.sessionId = evt.sid;
				}
			}
		})(this.eventNames[i], this);
	}

	if(!OtherArgs){
		OtherArgs = {};
	}

	// create the flash phone itself and allow for some immediate events
	// that would otherwise be missed.
	var suppression = true;
	if(OtherArgs.suppressRingSound !== undefined){
		suppression = OtherArgs.suppressRingSound;
	}
	var flashvars = {
		rtmp_url: 'rtmp://' + rtmpUrl + '/phone',
		suppressRingSound: suppression
	};
	var params = {
		allowScriptAccess: 'always'
	};

	var pathToSwf = "";
	if(OtherArgs.pathToFreeswitchSwf){
		pathToSwf = OtherArgs.pathToFreeswitchSwf;
	}

	swfobject.embedSWF(pathToSwf + "freeswitch.swf", parentNode, "250", "150", "9.0.0", "expressInstall.swf", flashvars, params, []);
	this.flashObject = document.getElementById(parentNode);
	if(OtherArgs.onInit){
		this.flashObject.addEventListener("onInit", OtherArgs.onInit, false);
	}
	if(OtherArgs.onConnected){
		this.flashObject.addEventListener("onConnected", OtherArgs.onConnected, false);
	}
	if(OtherArgs.onDebug){
		this.flashObject.addEventListener("onDebug", OtherArgs.onDebug, false);
	}

	// subscribe self to some important events.
	var iThis = this;
	this.flashObject.addEventListener("onLogin", function(loginEvent){
		iThis._onLogin(loginEvent);
	}, false);
	this.flashObject.addEventListener("onLogout", function(logoutEvent){
		iThis._onLogout(logoutEvent);
	}, false);
	this.flashObject.addEventListener("onIncomingCall", function(incomingEvent){
		iThis._onIncomingCall(incomingEvent);
	}, false);
	this.flashObject.addEventListener("onHangup", function(hupEvent){
		iThis._onHangup(hupEvent);
	}, false);
	this.flashObject.addEventListener("onMakeCall", function(callevent){
		iThis._onMakeCall(callevent);
	}, false);
}

/**
@private
*/
flashPhone.prototype._onLogin = function(evt){
	if(evt.success == true){
		this.user = evt.user;
		this.domain = evt.domain;
		this.register();
	}
}

/**
@private
*/
flashPhone.prototype._onLogout = function(evt){
	if(evt.user == this.user && evt.domain == this.domain){
		delete this.user;
		delete this.domain;
		delete this.registered;
	}
}

/**
@private
*/
flashPhone.prototype._onIncomingCall = function(evt){
	if(this.oncallId || this.ringId){
		this.flashObject.hangup(evt.uuid);
	} else {
		this.ringId = evt.uuid;
	}
}

/**
@private
*/
flashPhone.prototype._onHangup = function(evt){
	if(this.oncallId == evt.uuid){
		delete this.oncallId;
	} else if(this.ringId == evt.uuid){
		delete this.ringId;
	}
}

/**
@private
*/
flashPhone.prototype._onMakeCall = function(callevent){
	delete this.ringId;
	this.oncallId = callevent.uuid;
}

/**
@private
Takes an event name and arguments generated by the flash external interface
and creates a custom javascript event to be dispatched.
*/
flashPhone.createEvent = function(eventName, args){
	var evt = document.createEvent("Event");
	evt.initEvent(eventName, true, true);
	switch(eventName){
		case "onConnected":
			evt.sid = args[0];
			break;
		case "onHangup":
			evt.uuid = args[0];
			evt.cause = args[1];
			break;
		case "onLogin":
			evt.result = args[0];
			if(evt.result == "success"){
				evt.success = true;
			} else {
				evt.success = false;
			}
			evt.user = args[1];
			evt.domain = args[2];
			break;
		case "onLogout":
			evt.user = args[0];
			evt.domain = args[1];
			break;
		case "onAttach":
			evt.uuid = args[0];
			break;
		case "onMakeCall":
			evt.uuid = args[0];
			evt.number = args[1];
			evt.account = args[2];
			break;
		case "onCallState":
			evt.uuid = args[0];
			evt.state = args[1];
			break;
		case "onDisplayUpdate":
			evt.uuid = args[0];
			evt.name = args[1];
			evet.number = args[2];
			break;
		case "onIncomingCall":
			evt.uuid = args[0];
			evt.name = args[1];
			evt.number = args[2];
			evt.account = args[3];
			evt['evt'] = args[4];
			break;
		case "onEvent":
			evt['event'] = args[0];
			break;
		case "onDebug":
			evt.message = args[0];
			break;
		case "onInit":
		case "onDisconnected":
			break;
	}
	return evt;
}

/**
Log into the FreeSWITCH server as an rtmp user.
@param {String} username Username, including domain, e.g.:  
	user@example.com.
@param {String} password Password
@param {String} [nick] Nickname that can be used in place of the
	user@domain for some actions.
*/
flashPhone.prototype.login = function(username, password, nick){
	if(this.user){
		return false;
	}
	this.nickname = nick;
	return this.flashObject.login(username, password);
}

/**
Log out.  Does not disconnect.
*/
flashPhone.prototype.logout = function(){
	if(! this.user){
		return false;
	}
	return this.flashObject.logout(this.user + "@" + this.domain);
}

/**
Make a call to a given number.
@param {String} number Phone number or endpoint to dial.
@param {Object} [options] Additional options.  TOD.
*/
flashPhone.prototype.makeCall = function(number, options){
	if(!options){
		options = {};
	}
	if(this.oncallId){
		return false;
	}
	if(! this.user){
		return false;
	}
	var user = this.user + "@" + this.domain;
	return this.flashObject.makeCall(number, user, options);
}

// TODO find out what attach done and potentially streamline
flashPhone.prototype.attach = function(uuid){
	return this.flashObject.attach(uuid);
}

/**
Answers a ringing phone.
*/
flashPhone.prototype.answer = function(){
	if(! this.ringId){
		return false;
	}
	return this.flashObject.answer(this.ringId);
}

/**
Hangs up an asnwered or ringing phone.
*/
flashPhone.prototype.hangup = function(){
	var uuid;
	if(this.oncallId){
		uuid = this.oncallId;
	} else if(this.ringId){
		uuid = this.ringId;
	}
	if(! uuid){
		return false;
	}
	return this.flashObject.hangup(uuid);
}

/**
Simulates a button press on a phone's dial pad.
@param {String} digit The number or symbol to press.  One of "0123456789*#".
@param {Integer} duration How long to keep the button held down.
*/
flashPhone.prototype.sendDTMF = function(digit, duration){
	if(! duration){
		duration = 100;
	}
	return this.flashObject.sendDTMF(digit, duration);
}

/**
Registers the given user, domain, and nick to freeswitch.  Does not usually
need to called directly, as the wrapped login function will do this for you
automatically.  Will return false if phone is already registered.
@param {String} user The username to register.
@param {String} domain The domain name to register under.
@param {String} [nick] The nickname to use; defaults to "".
*/
flashPhone.prototype.register = function(user, domain, nick){
	if(this.registered){
		return false;
	}
	var fullUser;
	if(arguments.length == 0){
		if(! this.user){
			return false;
		}
		fullUser = this.user + "@" + this.domain;
		nick = this.nickname;
	} else if(arguments.length == 1){
		fullUser = arguments[0];
		nick = "";
	} else if(arguments.length == 2){
		fullUser = arguments[0];
		nick = arguments[1];
	} else {
		fullUser = user + "@" + domain;
	}
	this.registered = true;
	return this.flashObject.register(fullUser, nick);
}

/**
Unregisters the user.  Unlikely this will be needed.
@param {String} account user@domain to be unregistered.
@param {String} nick Nickname user was registered as.
*/
flashPhone.prototype.unregister = function(account, nick){
	if(! user && ! this.user){
		return false;
	}
	if(! user){
		user = this.user + "@" + this.domain;
	}
	if(! nick){
		nick = "";
	}
	return this.flashObject.unregister(user, nick);
}

flashPhone.prototype.transfer = function(){
	var uuid, dest;
	if(arguments.length == 1){
		uuid = this.oncallId;
		dest = arguments[0];
	}
	if(arguments.length == 2){
		uuid = arguments[0];
		dest = arguments[1];
	}
	if(! uuid){
		return false;
	}
	return this.flashObject.transfer(uuid, dest);
}

flashPhone.prototype.threeWay = function(){
	var uuid1, uuid2;
	if(arguments.length == 1){
		uuid1 = this.oncallId;
		uuid2 = arguments[0];
	}
	if(arguments.length == 2){
		uuid1 = arguments[0];
		uuid2 = arguments[1];
	}
	if(! uuid1){
		return false;
	}
	return this.flashObject.three_way(uuid1, uuid2);
}

/**
Returns the mic the flash phone is using.
*/
flashPhone.prototype.getMic = function(){
	return this.flashObject.getMic();
}

/**
Returns a list of the mics the flashphone is aware of.
*/
flashPhone.prototype.micList = function(){
	return this.flashObject.micList();
}

/**
Sets the mic.
@param {String} mic Use the mic with the given name.  Should be one of the
	results from getMic.
*/
flashPhone.prototype.setMic = function(mic){
	return this.flashObject.setMic(mic);
}

/**
Can you hear me now?
*/
flashPhone.prototype.isMuted = function(){
	return this.flashObject.isMuted;
}

/**
Attempt to display the privacy dialog for flash.  Useful if isMuted returns
false.  
*/
flashPhone.prototype.showPrivacy = function(){
	return this.flashObject.showPrivacy();
}

/**
Should not need to use this, unless you disconnected earlier.
*/
flashPhone.prototype.connect = function(){
	return this.flashObject.connect();
}

/**
Hari-kari.
*/
// TODO confirm if we want this
flashPhone.prototype.disconnect = function(){
	return this.flashObject.disconnect();
}

// TODO What does join do?
flashPhone.prototype.join = function(){
	var selfId, otherId;
	if(arguments.length == 1){
		selfId = this.oncallId;
		otherId = arguments[0];
	}
	if(arguments.length == 2){
		selfId = arguments[0];
		otherId = arguments[1];
	}
	if(! selfId){
		return false;
	}
	return this.flashObject.join(selfId, otherId);
}

flashPhone.prototype.sendevent = function(evt){
	return this.flashObject.sendevent(evt);
}

/**
Sets the volume of the audio coming into the flashPhone.
@param {Integer} vol Volume level to use.  Lowest is -4, highest is 4.
*/
flashPhone.prototype.setVolume = function(vol){
	return this.flashObject.setVolume(vol);
}

/**
Set a server-side mic boost.
@param {Integer} vol Boost to set.  Lowest, -4, softens the sound, while 
	highest of 4 boosts.
*/
flashPhone.prototype.setMicVolume = function(vol){
	return this.flashObject.setMicVolume(vol);
}

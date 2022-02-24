/////////////////////
//// for sockets
/////////////////////
//https://blog.miguelgrinberg.com/post/easy-websockets-with-flask-and-gevent

//https://github.com/miguelgrinberg/Flask-SocketIO
function connectViewerSocket(){
	//$(document).ready(function() {
	document.addEventListener("DOMContentLoaded", function(event) { 
		// Event handler for new connections.
		// The callback function is invoked when a connection with the
		// server is established.
		socketParams.socket.on('connect', function() {
			socketParams.socket.emit('connection_test', {data: 'Viewer connected!'});
		});
		socketParams.socket.on('connection_response', function(msg) {
			console.log('connection response', msg);
		});     
		// Event handler for server sent data.
		// The callback function is invoked whenever the server emits data
		// to the client. The data is then displayed in the "Received"
		// section of the page.
		//updates from GUI
		socketParams.socket.on('update_viewerParams', function(msg) {
			setParams(msg);
		});

		socketParams.socket.on('show_loader', function(msg) {
			d3.select("#splashdivLoader").selectAll('svg').remove();
			d3.select("#splashdiv5").text("Loading...");
			d3.select("#loader").style("display","visible");
			viewerParams.loaded = false;
			viewerParams.pauseAnimation = true;

			viewerParams.loadfrac = 0.;
			drawLoadingBar();

			showSplash();
		});

		socketParams.socket.on('input_data', function(msg) {
			//only tested for local (GUI + viewer in one window)
			console.log("======== have new data : ", Object.keys(msg));


			//first compile the data from multiple calls
			if ('status' in msg){
				if (msg.status == 'start') {
					var socketCheck = viewerParams.usingSocket;
					var localCheck = viewerParams.local;
					//in case it's already waiting, which will happen if loading an hdf5 file from the gui
					clearInterval(viewerParams.waitForInit);
					defineViewerParams();
					viewerParams.pauseAnimation = true;
					viewerParams.usingSocket = socketCheck; 
					viewerParams.local = localCheck; 

					viewerParams.newInternalData.data = {};
					viewerParams.newInternalData.len = msg.length;
					viewerParams.newInternalData.count = 0;
				}
				if (msg.status == 'data') {
					viewerParams.newInternalData.count += 1;
					//I will update the loading bar here, but I'm not sure what fraction of the time this should take (using 0.8 for now)
					viewerParams.loadfrac = (viewerParams.newInternalData.count/viewerParams.newInternalData.len)*0.8; 
					updateLoadingBar();
					Object.keys(msg).forEach(function(key,i){
						if (key != 'status'){
							viewerParams.newInternalData.data[key] = JSON.parse(msg[key]);
							if (key.includes('filenames.json')){
								viewerParams.filenames = JSON.parse(msg[key]);
							}
						}
					})
				}
				if (msg.status == 'done'){
					console.log('======== have all data', viewerParams.newInternalData, viewerParams.filenames);
					loadData(initInputData, prefix='', internalData=viewerParams.newInternalData.data, initialLoadFrac=viewerParams.loadfrac)
				}
			}

		});

		socketParams.socket.on('update_streamer', function(msg) {
			viewerParams.streamReady = true;
		});
		socketParams.socket.on('reload_viewer', function(msg) {
			console.log('!!! reloading viewer');
			location.reload();
		});
	});
}

function initInputData(){
	console.log('======== remaking gui and viewer')
	var forGUIprepend = [];
	forGUIprepend.push({'clearGUIinterval':null});
	forGUIprepend.push({'defineGUIParams':null});

	var forGUIappend = [];
	forGUIappend.push({'setGUIParamByKey':[viewerParams.usingSocket, "usingSocket"]});
	forGUIappend.push({'setGUIParamByKey':[viewerParams.local, "local"]});
	forGUIappend.push({'makeUI':viewerParams.local});

	//I think I need to wait a moment because sometimes this doesn't fire (?)
	setTimeout(function(){
		makeViewer(null, forGUIprepend, forGUIappend);
		WebGLStart();
	}, 1000);



}

//so that it can run locally also without using Flask
// note that if allowVRControls == true, then you do not want to start in stereo (the VR button will do the work)
function runLocal(useSockets=true, showGUI=true, allowVRControls=false, startStereo=false, pSize=null){
	viewerParams.local = true;
	viewerParams.usingSocket = useSockets;
	forGUI = [];
	forGUI.push({'setGUIParamByKey':[viewerParams.usingSocket, "usingSocket"]});
	forGUI.push({'setGUIParamByKey':[viewerParams.local, "local"]});
	sendToGUI(forGUI);

	viewerParams.initialStereo = startStereo;
	viewerParams.allowVRControls = allowVRControls;

	// it appears that in order for Firefly to start correctly, it must be initialized to non-stereo and trackbacl
	// I will re-initialize them to the proper values after the first render pass
	viewerParams.useTrackball = true;
	viewerParams.useStereo = false;

	//both of these start setIntervals to wait for the proper variables to be set
	makeViewer(pSize);
	if (showGUI) {
		makeUI(local=true);
	} else {
		d3.selectAll('.UIcontainer').classed('hidden', true)
	}
	
	//This will  load the data, and then start the WebGL rendering
	getFilenames(prefix = "static/");

}

//wait for all the input before loading
function makeViewer(pSize=null, prepend=[], append=[]){
	viewerParams.haveUI = false;
	viewerParams.ready = false; 
	console.log("Waiting for viewer init ...")
	clearInterval(viewerParams.waitForInit);
	viewerParams.waitForInit = setInterval(function(){ 
		var ready = confirmViewerInit();
		if (ready){
			console.log("Viewer ready.")
			clearInterval(viewerParams.waitForInit);
			viewerParams.ready = true;
			viewerParams.pauseAnimation = false;
			viewerParams.parts.options0 = createPreset(); //this might break things if the presets don't work...
			console.log("initial options", viewerParams.parts.options)

			//to test
			if (pSize) {
				viewerParams.PsizeMult.Gas = pSize;
				console.log('new Psize', pSize)
			}
			sendInitGUI(prepend=prepend, append=append);
		}
	}, 100);
}

//if startup.json exists, this is called first
function getFilenames(prefix=""){
	d3.json(prefix+viewerParams.startup,  function(dir) {
		console.log(prefix, dir, viewerParams.startup, viewerParams)
		if (dir != null){
			var i = 0;
			viewerParams.dir = dir;
			if (Object.keys(viewerParams.dir).length > 1){
				i = null
				console.log("multiple file options in startup:", Object.keys(viewerParams.dir).length, viewerParams.dir);
				var forGUI = [];
				forGUI.push({'setGUIParamByKey':[viewerParams.dir, "dir"]});
				forGUI.push({'showLoadingButton':'#selectStartupButton'});
				forGUI.push({'selectFromStartup':prefix});
				sendToGUI(forGUI);
			} 
			if (i != null && i < Object.keys(viewerParams.dir).length){
				d3.json(prefix+viewerParams.dir[i] + "/filenames.json",  function(files) {
					if (files != null){
						callLoadData([files, prefix]);
					} else {
						sendToGUI([{'showLoadingButton':'#loadDataButton'}]);
						alert("Cannot load data. Please select another directory.");
					}
				});
			}
		} else {
			sendToGUI([{'showLoadingButton':'#loadDataButton'}]);
		}
	});
}

//once a data directory is identified, this will define the parameters, draw the loading bar and, load in the data
function callLoadData(args){
	var files = args[0];
	var prefix = "";
	if (args.length > 0) prefix = args[1];

	var dir = {};
	if (viewerParams.hasOwnProperty('dir')){
		dir = viewerParams.dir;
	}
	viewerParams.dir = dir;
	sendToGUI([{'setGUIParamByKey':[viewerParams.dir, "dir"]}]);

	drawLoadingBar();
	viewerParams.filenames = files;
	console.log("loading new data", files)
	loadData(WebGLStart, prefix);
}

// launch the app control flow, >> ends in animate <<
function WebGLStart(){

	//reset the window title
	if (viewerParams.parts.hasOwnProperty('options')){
		if (viewerParams.parts.options.hasOwnProperty('title')){
			window.document.title = viewerParams.parts.options.title
		}
	}

	document.addEventListener('mousedown', handleMouseDown);

	//initialize various values for the parts dict from the input data file, 
	initPVals();

	initScene();
	
	initColumnDensity();

	if (viewerParams.haveAnyOctree) createOctreeLoadingBar()

	//draw everything
	Promise.all([
		createPartsMesh(),
	]).then(function(){
		
		//begin the animation
		// keep track of runtime for crashing the app rather than the computer
		var currentTime = new Date();
		var seconds = currentTime.getTime()/1000;
		viewerParams.currentTime = seconds;

		viewerParams.pauseAnimation = false;
		animate();

	})



}

//initialize various values for the parts dict from the input data file, 
function initPVals(){

	for (var i=0; i<viewerParams.partsKeys.length; i++){
		var p = viewerParams.partsKeys[i];
		if (! viewerParams.reset){
			viewerParams.partsMesh[p] = [];
		}

		//misc
		if (!viewerParams.haveOctree[p]) viewerParams.plotNmax[p] = viewerParams.parts.count[p];
		viewerParams.PsizeMult[p] = 1.;
		viewerParams.showParts[p] = true;
		viewerParams.updateOnOff[p] = false;

		//filter
		viewerParams.updateFilter[p] = false;
		viewerParams.filterLims[p] = {};
		viewerParams.filterVals[p] = {};
		viewerParams.invertFilter[p] = {};
		viewerParams.fkeys[p] = [];

		//colormap
		viewerParams.ckeys[p] = [];
		viewerParams.colormapVariable[p] = 0;
		viewerParams.colormap[p] = 4/256;
		viewerParams.showColormap[p] = false;
		viewerParams.updateColormap[p] = false;
		viewerParams.colormapVals[p] = {};
		viewerParams.colormapLims[p] = {};

		//blending
		viewerParams.blendingMode[p] = 'additive';
		viewerParams.depthWrite[p] = false;
		viewerParams.depthTest[p] = false;

		//velocities
		viewerParams.showVel[p] = false;
		viewerParams.velVectorWidth[p] = 1.;
		viewerParams.velGradient[p] = 0.; //0 == false, 1 == true
		viewerParams.animateVel[p] = false;
		viewerParams.animateVelDt[p] = 0.;
		viewerParams.animateVelTmax[p] = 0.;
		if (viewerParams.parts[p].Velocities_flat != null){
			if (!viewerParams.reset && !viewerParams.haveOctree[p]){
				calcVelVals(p);
				if(!viewerParams.parts[p].hasOwnProperty("filterKeys")){
					viewerParams.parts[p].filterKeys = [];
				}
			 
			}
			viewerParams.velType[p] = 'line';
		}
		
		//filters
		//in case there are no filter possibilities (but will be overwritten below)
		viewerParams.fkeys[p] = ["None"];
		viewerParams.filterLims[p]["None"] = [0,1];
		viewerParams.filterVals[p]["None"] = [0,1]; 
		var haveCurrentFilter = true;
		if (viewerParams.parts[p].currentlyShownFilter == undefined) {
			viewerParams.parts[p].currentlyShownFilter = ["None"];
			haveCurrentFilter = false;
		}
		if (viewerParams.parts[p].hasOwnProperty("filterKeys")){
			viewerParams.fkeys[p] = viewerParams.parts[p].filterKeys;
			viewerParams.parts[p]['playbackTicks'] = 0;
			viewerParams.parts[p]['playbackTickRate'] = 10;   
			for (var k=0; k<viewerParams.fkeys[p].length; k++){
				// TODO we should consider removing this "feature"
				//  and just require users to pass in the mag velocity
				//  as its own field-- or also radius and do radius/speed
				//  flags or something
				//if (viewerParams.fkeys[p][k] == "Velocities"){
					//viewerParams.fkeys[p][k] = "magVelocities";
				//}
				var fkey = viewerParams.fkeys[p][k];
				//calculate limits for the filters
				if (viewerParams.parts[p][fkey] != null){
					var m = calcMinMax(p,fkey)
					viewerParams.filterLims[p][fkey] = [m.min, m.max];
					viewerParams.filterVals[p][fkey] = [m.min, m.max];
					viewerParams.invertFilter[p][fkey] = false;
					// set the currently shown filter for each part type at startup
					// so the first click isn't broken
					if (!haveCurrentFilter) {
						viewerParams.parts[p].currentlyShownFilter = fkey;
						haveCurrentFilter = true;
					}
				}
			}
		}
		//colormap
		//in case there are no colormap possibilities (but will be overwritten below)
		viewerParams.ckeys[p] = ["None"];
		viewerParams.colormapLims[p]["None"] = [0,1];
		viewerParams.colormapVals[p]["None"] = [0,1];
		if (viewerParams.parts[p].hasOwnProperty("colormapKeys")){
			if (viewerParams.parts[p].colormapKeys.length > 0){
				viewerParams.ckeys[p] = viewerParams.parts[p].colormapKeys;
				for (var k=0; k<viewerParams.ckeys[p].length; k++){
						// TODO we should consider removing this "feature"
						//  and just require users to pass in the mag velocity
						//  as its own field-- or also radius and do radius/speed
						//  flags or something
					//if (viewerParams.ckeys[p][k] == "Velocities"){
						//viewerParams.ckeys[p][k] = "magVelocities";
					//}
					var ckey = viewerParams.ckeys[p][k];
					viewerParams.colormapLims[p][ckey] = [0,1];
					viewerParams.colormapVals[p][ckey] = [0,1];
					if (viewerParams.parts[p][ckey] != null){
						//could probably take results from filter to save time, but will do this again to be safe
						var m = calcMinMax(p,ckey)
						viewerParams.colormapLims[p][ckey] = [m.min, m.max];
						viewerParams.colormapVals[p][ckey] = [m.min, m.max];
					}
////////////////////////////////////////////////////////////////////////                    
////////////// I am not sure where to put this <-- I don't think this is used anymore (?)
////////////////////////////////////////////////////////////////////////                    
					if (i == viewerParams.partsKeys.length - 1 && k == viewerParams.ckeys[p].length -1) viewerParams.ready = true;
////////////////////////////////////////////////////////////////////////                    
////////////////////////////////////////////////////////////////////////                    
				}
			}
		}


	}



}

// size the window and optionally initialize stereo view
function initScene() {
	var screenWidth = window.innerWidth;
	var screenHeight = window.innerHeight;
	var aspect = screenWidth / screenHeight;

	viewerParams.renderWidth = window.innerWidth;
	viewerParams.renderHeight = window.innerHeight;

	if (viewerParams.reset){
		viewerParams.scene = null;
		viewerParams.camera = null;
		viewerParams.frustum = null;
	} else{

		 //keyboard
		viewerParams.keyboard = new KeyboardState();

		// renderer
		if ( Detector.webgl ) {
			viewerParams.renderer = new THREE.WebGLRenderer( {
				antialias:true,
				//preserveDrawingBuffer: true , //so that we can save the image
			} );

		} else {
			//Canvas Renderer has been removed, and I can't get the old version to work now
			//viewerParams.renderer = new THREE.CanvasRenderer(); 
			alert("Your browser does not support WebGL.  Therefore Firefly cannot run.  Please use a different browser.");

		}
		viewerParams.renderer.setSize(screenWidth, screenHeight);
		viewerParams.normalRenderer = viewerParams.renderer;

		d3.select('#WebGLContainer').selectAll("canvas").remove();

		viewerParams.container = document.getElementById('WebGLContainer');
		viewerParams.container.appendChild( viewerParams.renderer.domElement );

		//stereo
		viewerParams.effect = new THREE.StereoEffect( viewerParams.renderer );
		viewerParams.effect.setAspect(1.);
		viewerParams.effect.setEyeSeparation(viewerParams.stereoSep);

		// Wtarting with stereo seems to break things (e.g., I can't change particle sizes)
		//   but it works fine if I toggle stereo in the GUI.  I have no idea why this breaks.
		// So, I will switch to stereo if needed after the first render pass (?)
		// 
		// if (viewerParams.useStereo){
		// 	viewerParams.normalRenderer = viewerParams.renderer;
		// 	viewerParams.renderer = viewerParams.effect;
		// }
	}

	// scene
	viewerParams.scene = new THREE.Scene();     

	// camera
	viewerParams.camera = new THREE.PerspectiveCamera( viewerParams.fov, aspect, viewerParams.zmin, viewerParams.zmax);
	viewerParams.camera.up.set(0, -1, 0);
	viewerParams.scene.add(viewerParams.camera);  

	viewerParams.frustum = new THREE.Frustum();

	// events
	THREEx.WindowResize(viewerParams.renderer, viewerParams.camera);
	//THREEx.FullScreen.bindKey({ charCode : 'm'.charCodeAt(0) });

	//viewerParams.useTrackball = true;

	//console.log(viewerParams.parts.options);
	setCenter(viewerParams.parts[viewerParams.partsKeys[0]].Coordinates_flat);
	viewerParams.camera.position.set(viewerParams.center.x, viewerParams.center.y, viewerParams.center.z - viewerParams.boxSize/2.);
	viewerParams.camera.lookAt(viewerParams.scene.position);  

	//apply presets from the options file
	if (viewerParams.parts.hasOwnProperty('options')) applyOptions();

	// controls
	initControls();

	// add button to enable VR
	if (viewerParams.allowVRControls) {
		document.body.appendChild( VRButton.createButton( viewerParams.renderer ) );
		viewerParams.renderer.xr.enabled = true;
	}
	
	//investigating the minimum point size issue
	// console.log("context", viewerParams.renderer.context)
	// //maybe glDisable(GL_POINT_SMOOTH); would solve the point size issue?
	// //see also GL_POINT_SIZE_RANGE
	// var canvas = d3.select('canvas').node();
	// var gl = canvas.getContext('webgl');
	// console.log(gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE), gl.getParameter(gl.POINT_SMOOTH));
}

// apply any settings from options file
function applyOptions(){

	//initialize center
	if (viewerParams.parts.options.hasOwnProperty('center')){
		if (viewerParams.parts.options.center != null){
			viewerParams.center = new THREE.Vector3(viewerParams.parts.options.center[0], viewerParams.parts.options.center[1], viewerParams.parts.options.center[2]);
			setBoxSize(viewerParams.parts[viewerParams.partsKeys[0]].Coordinates_flat);
		} else {
			viewerParams.parts.options.center = [viewerParams.center.x, viewerParams.center.y, viewerParams.center.z];
		}
	} else {
		viewerParams.parts.options.center = [viewerParams.center.x, viewerParams.center.y, viewerParams.center.z];
	}

	//change location of camera
	if (viewerParams.parts.options.hasOwnProperty('camera')){
		if (viewerParams.parts.options.camera != null){
			viewerParams.camera.position.set(viewerParams.parts.options.camera[0], viewerParams.parts.options.camera[1], viewerParams.parts.options.camera[2]);
		}
	} 

	//change the rotation of the camera 
	if (viewerParams.parts.options.hasOwnProperty('cameraRotation')){
		if (viewerParams.parts.options.cameraRotation != null){
			viewerParams.camera.rotation.set(viewerParams.parts.options.cameraRotation[0], viewerParams.parts.options.cameraRotation[1], viewerParams.parts.options.cameraRotation[2]);
		}
	}

	//change the up vector of the camera (required to get the rotation correct)
	if (viewerParams.parts.options.hasOwnProperty('cameraUp')){
		if (viewerParams.parts.options.cameraUp != null){
			viewerParams.camera.up.set(viewerParams.parts.options.cameraUp[0], viewerParams.parts.options.cameraUp[1], viewerParams.parts.options.cameraUp[2]);
		}
	}

	//check if we are starting in Fly controls
	if (viewerParams.parts.options.hasOwnProperty('startFly')){
		if (viewerParams.parts.options.startFly == true){
			viewerParams.useTrackball = false;
		}
	}

	//check if we are starting in VR controls
	if (viewerParams.parts.options.hasOwnProperty('startVR')){
		if (viewerParams.parts.options.startVR == true){
			viewerParams.allowVRControls = true;
		}
	}

	//modify the initial friction
	if (viewerParams.parts.options.hasOwnProperty('friction')){
		if (viewerParams.parts.options.friction != null){
			viewerParams.friction = viewerParams.parts.options.friction;
		}
	}

	//check if we are starting in Stereo
	if (viewerParams.parts.options.hasOwnProperty('stereo')){
		if (viewerParams.parts.options.stereo == true){
			viewerParams.normalRenderer = viewerParams.renderer;
			viewerParams.renderer = viewerParams.effect;
			viewerParams.useStereo = true;
			if (viewerParams.haveUI){
				var evalString = 'elm = document.getElementById("StereoCheckBox"); elm.checked = true; elm.value = true;'
				sendToGUI([{'evalCommand':[evalString]}]);
			}
		}
	}

	//modify the initial stereo separation
	if (viewerParams.parts.options.hasOwnProperty('stereoSep')){
		if (viewerParams.parts.options.stereoSep != null){
			viewerParams.stereoSep = viewerParams.parts.options.stereoSep;
			viewerParams.effect.setEyeSeparation(viewerParams.stereoSep);

		}
	}

	//modify the initial decimation
	if (viewerParams.parts.options.hasOwnProperty('decimate')){
		if (viewerParams.parts.options.decimate != null){
			viewerParams.decimate = viewerParams.parts.options.decimate;
		}
	}

	//maximum range in calculating the length the velocity vectors
	if (viewerParams.parts.options.hasOwnProperty("maxVrange")){
		if (viewerParams.parts.options.maxVrange != null){
			viewerParams.maxVrange = viewerParams.parts.options.maxVrange; //maximum dynamic range for length of velocity vectors
			for (var i=0; i<viewerParams.partsKeys.length; i++){
				var p = viewerParams.partsKeys[i];
				if (viewerParams.parts[p].Velocities_flat != null && !viewerParams.haveOctree[p]){
					calcVelVals(p);     
				}
			}
		}
	}

    // add an annotation to the top if necessary
	if (viewerParams.parts.options.hasOwnProperty('annotation')){
		if (viewerParams.parts.options.annotation != null){
			elm = document.getElementById('annotate_container');
			elm.innerHTML=viewerParams.parts.options.annotation;
			elm.style.display='block';
		}
    }

	// flag to show fps in top right corner
	if (viewerParams.parts.options.hasOwnProperty('showfps')){
		if (viewerParams.parts.options.showfps != null){
			viewerParams.showfps = viewerParams.parts.options.showfps;
		}
    }

	// flag to show fps in top right corner
	if (viewerParams.parts.options.hasOwnProperty('start_tween')){
		if (viewerParams.parts.options.start_tween){
			viewerParams.updateTween = true	
			setTweenviewerParams();
		}
	}

	//particle specific options
	for (var i=0; i<viewerParams.partsKeys.length; i++){
		var p = viewerParams.partsKeys[i];

		//on/off
		if (viewerParams.parts.options.hasOwnProperty("showParts")){
			if (viewerParams.parts.options.showParts != null){
				if (viewerParams.parts.options.showParts.hasOwnProperty(p)){
					if (viewerParams.parts.options.showParts[p] != null){
						viewerParams.showParts[p] = viewerParams.parts.options.showParts[p];
					}
				}
			}
		}

		//size
		if (viewerParams.parts.options.hasOwnProperty("sizeMult")){
			if (viewerParams.parts.options.sizeMult != null){
				if (viewerParams.parts.options.sizeMult.hasOwnProperty(p)){
					if (viewerParams.parts.options.sizeMult[p] != null){
						viewerParams.PsizeMult[p] = viewerParams.parts.options.sizeMult[p];
					}
				}
			}
		}

		//color
		if (viewerParams.parts.options.hasOwnProperty("color")){
			if (viewerParams.parts.options.color != null){
				if (viewerParams.parts.options.color.hasOwnProperty(p)){
					if (viewerParams.parts.options.color[p] != null){
						viewerParams.Pcolors[p] = viewerParams.parts.options.color[p];
					}
				}
			}
		}



		//maximum number of particles to plot
		if (viewerParams.parts.options.hasOwnProperty("plotNmax")){
			if (viewerParams.parts.options.plotNmax != null){
				if (viewerParams.parts.options.plotNmax.hasOwnProperty(p)){
					if (viewerParams.parts.options.plotNmax[p] != null){
						viewerParams.plotNmax[p] = viewerParams.parts.options.plotNmax[p];
					}
				}
			}
		}

		//start plotting the velocity vectors
		if (viewerParams.parts.options.hasOwnProperty("showVel")){
			if (viewerParams.parts.options.showVel != null){
				if (viewerParams.parts.options.showVel.hasOwnProperty(p)){
					if (viewerParams.parts.options.showVel[p] == true){
						viewerParams.showVel[p] = true;
						if (viewerParams.haveUI){
							var evalString = 'elm = document.getElementById("'+p+'velCheckBox"); elm.checked = true; elm.value = true;'
							sendToGUI([{'evalCommand':[evalString]}]);
						}
					}
				}
			}
		}

		//type of velocity vectors
		if (viewerParams.parts.options.hasOwnProperty("velType")){
			if (viewerParams.parts.options.velType != null){
				if (viewerParams.parts.options.velType.hasOwnProperty(p)){
					if (viewerParams.parts.options.velType[p] == 'line' || viewerParams.parts.options.velType[p] == 'arrow' || viewerParams.parts.options.velType[p] == 'triangle'){
						viewerParams.velType[p] = viewerParams.parts.options.velType[p];
					}
				}
			}
		}

		//velocity vector width
		if (viewerParams.parts.options.hasOwnProperty("velVectorWidth")){
			if (viewerParams.parts.options.velVectorWidth != null){
				if (viewerParams.parts.options.velVectorWidth.hasOwnProperty(p)){
					viewerParams.velVectorWidth[p] = viewerParams.parts.options.velVectorWidth[p]; 
				}
			}
		}

		//velocity vector gradient
		if (viewerParams.parts.options.hasOwnProperty("velGradient")){
			if (viewerParams.parts.options.velGradient != null){
				if (viewerParams.parts.options.velGradient.hasOwnProperty(p)){
					viewerParams.velGradient[p] = +viewerParams.parts.options.velGradient[p]; //convert from bool to int
				}
			}
		}

		//start showing the velocity animation
		if (viewerParams.parts.options.hasOwnProperty("animateVel")){
			if (viewerParams.parts.options.animateVel != null){
				if (viewerParams.parts.options.animateVel.hasOwnProperty(p)){
					if (viewerParams.parts.options.animateVel[p] == true){
						viewerParams.animateVel[p] = true;
						if (viewerParams.haveUI){
							var evalString = 'elm = document.getElementById("'+p+'velAnimateCheckBox"); elm.checked = true; elm.value = true;'
							sendToGUI([{'evalCommand':[evalString]}]);
						}
					}
				}
			}
		}

		//animate velocity dt
		if (viewerParams.parts.options.hasOwnProperty("animateVelDt")){
			if (viewerParams.parts.options.animateVelDt != null){
				if (viewerParams.parts.options.animateVelDt.hasOwnProperty(p)){
					viewerParams.animateVelDt[p] = viewerParams.parts.options.animateVelDt[p];
				}
			}
		}

		//animate velocity tmax
		if (viewerParams.parts.options.hasOwnProperty("animateVelTmax")){
			if (viewerParams.parts.options.animateVelTmax != null){
				if (viewerParams.parts.options.animateVelTmax.hasOwnProperty(p)){
					viewerParams.animateVelTmax[p] = viewerParams.parts.options.animateVelTmax[p];
				}
			}
		}

		//filter values
		if (viewerParams.parts.options.hasOwnProperty("filterVals")){
			if (viewerParams.parts.options.filterVals != null){
				if (viewerParams.parts.options.filterVals.hasOwnProperty(p)){
					if (viewerParams.parts.options.filterVals[p] != null){
						viewerParams.updateFilter[p] = true

						for (k=0; k<viewerParams.fkeys[p].length; k++){
							var fkey = viewerParams.fkeys[p][k]
							if (viewerParams.parts.options.filterVals[p].hasOwnProperty(fkey)){
								if (viewerParams.parts.options.filterVals[p][fkey] != null){
									viewerParams.filterVals[p][fkey] = []
									viewerParams.filterVals[p][fkey].push(viewerParams.parts.options.filterVals[p][fkey][0]);
									viewerParams.filterVals[p][fkey].push(viewerParams.parts.options.filterVals[p][fkey][1]);

								}
							}
						}

					}
				}
			}
		}

		//filter limits
		if (viewerParams.parts.options.hasOwnProperty("filterLims")){
			if (viewerParams.parts.options.filterLims != null){
				if (viewerParams.parts.options.filterLims.hasOwnProperty(p)){
					if (viewerParams.parts.options.filterLims[p] != null){
						viewerParams.updateFilter[p] = true

						for (k=0; k<viewerParams.fkeys[p].length; k++){
							var fkey = viewerParams.fkeys[p][k]
							if (viewerParams.parts.options.filterLims[p].hasOwnProperty(fkey)){
								if (viewerParams.parts.options.filterLims[p][fkey] != null){
									viewerParams.filterLims[p][fkey] = []
									viewerParams.filterLims[p][fkey].push(viewerParams.parts.options.filterLims[p][fkey][0]);
									viewerParams.filterLims[p][fkey].push(viewerParams.parts.options.filterLims[p][fkey][1]);

								}
							}
						}

					}
				}
			}
		}

		//filter invert
		if (viewerParams.parts.options.hasOwnProperty("invertFilter")){
			if (viewerParams.parts.options.invertFilter != null){
				if (viewerParams.parts.options.invertFilter.hasOwnProperty(p)){
					if (viewerParams.parts.options.invertFilter[p] != null){

						for (k=0; k<viewerParams.fkeys[p].length; k++){
							var fkey = viewerParams.fkeys[p][k]
							if (viewerParams.parts.options.invertFilter[p].hasOwnProperty(fkey)){
								if (viewerParams.parts.options.invertFilter[p][fkey] != null){
									viewerParams.invertFilter[p][fkey] = viewerParams.parts.options.invertFilter[p][fkey];

								}
							}
						}

					}
				}
			}
		}

		//colormap limits
		if (viewerParams.parts.options.hasOwnProperty("colormapLims")){
			if (viewerParams.parts.options.colormapLims != null){
				if (viewerParams.parts.options.colormapLims.hasOwnProperty(p)){
					if (viewerParams.parts.options.colormapLims[p] != null){
						viewerParams.updateColormap[p] = true

						for (k=0; k<viewerParams.ckeys[p].length; k++){
							var ckey = viewerParams.ckeys[p][k]
							if (viewerParams.parts.options.colormapLims[p].hasOwnProperty(ckey)){
								if (viewerParams.parts.options.colormapLims[p][ckey] != null){
									viewerParams.colormapLims[p][ckey] = []
									viewerParams.colormapLims[p][ckey].push(viewerParams.parts.options.colormapLims[p][ckey][0]);
									viewerParams.colormapLims[p][ckey].push(viewerParams.parts.options.colormapLims[p][ckey][1]);

								}
							}
						}

					}
				}
			}
		}//colormap limits

		//colormap values
		if (viewerParams.parts.options.hasOwnProperty("colormapVals")){
			if (viewerParams.parts.options.colormapVals != null){
				if (viewerParams.parts.options.colormapVals.hasOwnProperty(p)){
					if (viewerParams.parts.options.colormapVals[p] != null){
						viewerParams.updateColormap[p] = true

						for (k=0; k<viewerParams.ckeys[p].length; k++){
							var ckey = viewerParams.ckeys[p][k]
							if (viewerParams.parts.options.colormapVals[p].hasOwnProperty(ckey)){
								if (viewerParams.parts.options.colormapVals[p][ckey] != null){
									viewerParams.colormapVals[p][ckey] = []
									viewerParams.colormapVals[p][ckey].push(viewerParams.parts.options.colormapVals[p][ckey][0]);
									viewerParams.colormapVals[p][ckey].push(viewerParams.parts.options.colormapVals[p][ckey][1]);
								}

							}
						}
					}
				}
			}
		}// colormap vals

		//start plotting with a colormap
		if (viewerParams.parts.options.hasOwnProperty("showColormap") &&
			viewerParams.parts.options.showColormap != null &&
			viewerParams.parts.options.showColormap.hasOwnProperty(p) &&
			viewerParams.parts.options.showColormap[p] == true){
			viewerParams.updateColormap[p] = true
			viewerParams.showColormap[p] = true;
			if (viewerParams.haveUI){
				console.log(p+'colorCheckBox')
				var evalString = 'elm = document.getElementById("'+p+'colorCheckBox"); elm.checked = true; elm.value = true;'
				sendToGUI([{'evalCommand':[evalString]}]);
			}
		}

		//choose which colormap to use
		if (viewerParams.parts.options.hasOwnProperty("colormap") && 
			viewerParams.parts.options.colormap != null &&
			viewerParams.parts.options.colormap.hasOwnProperty(p) && 
			viewerParams.parts.options.colormap[p] != null){

			viewerParams.colormap[p] = copyValue(viewerParams.parts.options.colormap[p]);

		}
		//select the colormap variable to color by
		if (viewerParams.parts.options.hasOwnProperty("colormapVariable") && 
			viewerParams.parts.options.colormapVariable != null &&
			viewerParams.parts.options.colormapVariable.hasOwnProperty(p) && 
			viewerParams.parts.options.colormapVariable[p] != null){

			viewerParams.colormapVariable[p] = copyValue(viewerParams.parts.options.colormapVariable[p]);


		}
	}// particle specific options

}

// connect fly/trackball controls
function initControls(updateGUI = true){

	var forGUI = []
	forGUI.push({'setGUIParamByKey':[viewerParams.useTrackball, "useTrackball"]})

	// Firefly seems to behave best when it is initialized with trackball controls.  If the user chooses a different set of controls
	// I will still initialize it with trackball, and then change after the first render pass
	if (viewerParams.useTrackball || viewerParams.drawPass < 1) { 
		console.log('initializing TrackballControls')
		viewerParams.controlsName = 'TrackballControls'
		var xx = new THREE.Vector3(0,0,0);
		viewerParams.camera.getWorldDirection(xx);
		viewerParams.controls = new THREE.TrackballControls( viewerParams.camera, viewerParams.renderer.domElement );
		viewerParams.controls.target = new THREE.Vector3(viewerParams.camera.position.x + xx.x, viewerParams.camera.position.y + xx.y, viewerParams.camera.position.z + xx.z);
		if (viewerParams.parts.hasOwnProperty('options') && !viewerParams.switchControls){
			if (viewerParams.parts.options.hasOwnProperty('center') ){
				if (viewerParams.parts.options.center != null){
					viewerParams.controls.target = new THREE.Vector3(viewerParams.parts.options.center[0], viewerParams.parts.options.center[1], viewerParams.parts.options.center[2]);

				}
			}
			if (viewerParams.parts.options.hasOwnProperty('cameraUp') ){
				if (viewerParams.parts.options.cameraUp != null){
					viewerParams.camera.up.set(viewerParams.parts.options.cameraUp[0], viewerParams.parts.options.cameraUp[1], viewerParams.parts.options.cameraUp[2]);
				}
			}
			//this does not work (a bug/feature of trackballControls)
			if (viewerParams.parts.options.hasOwnProperty('cameraRotation') ){
				if (viewerParams.parts.options.cameraRotation != null){
					viewerParams.camera.rotation.set(viewerParams.parts.options.cameraRotation[0], viewerParams.parts.options.cameraRotation[1], viewerParams.parts.options.cameraRotation[2]);
				}
			}

		} 
		viewerParams.controlsTarget = viewerParams.controls.target;
		viewerParams.controls.dynamicDampingFactor = viewerParams.friction;
		viewerParams.controls.addEventListener('change', sendCameraInfoToGUI);
	} else {
		console.log('initializing FlyControls')
		viewerParams.controlsName = 'FlyControls';
		viewerParams.controls = new THREE.FlyControls( viewerParams.camera , viewerParams.normalRenderer.domElement);
		viewerParams.controls.movementSpeed = (1. - viewerParams.friction)*viewerParams.flyffac;
	}

	if (viewerParams.haveUI){
		var evalString = 'elm = document.getElementById("CenterCheckBox"); elm.checked = '+viewerParams.useTrackball+'; elm.value = '+viewerParams.useTrackball+';'
		forGUI.push({'evalCommand':evalString});
	}

	viewerParams.switchControls = false;
	if (updateGUI) sendToGUI(forGUI);

}

// create CD texture buffers and parameters
function initColumnDensity(){
	//following this example: https://threejs.org/examples/webgl_rtt.html
	var screenWidth = window.innerWidth;
	var screenHeight = window.innerHeight;
	var aspect = screenWidth / screenHeight;

	//render texture
	viewerParams.textureCD = new THREE.WebGLRenderTarget( screenWidth, screenHeight, {
		minFilter: THREE.LinearFilter, 
		magFilter: THREE.NearestFilter, 
		format: THREE.RGBAFormat 
	} );

	//for now, just use the first colormap
	var p = viewerParams.partsKeys[0];
	viewerParams.materialCD = new THREE.ShaderMaterial( {
		uniforms: { 
			tex: { value: viewerParams.textureCD.texture }, 
			cmap: { type:'t', value: viewerParams.cmap },
			colormap: {value: viewerParams.colormap[p]},
		},
		vertexShader: myVertexShader,
		fragmentShader: myFragmentShader_pass2,
		depthWrite: false
	} );
	var plane = new THREE.PlaneBufferGeometry( screenWidth, screenHeight );
	viewerParams.quadCD = new THREE.Mesh( plane, viewerParams.materialCD );
	viewerParams.quadCD.position.z = -100;
	viewerParams.sceneCD = new THREE.Scene();
	viewerParams.sceneCD.add( viewerParams.quadCD );

	// camera
	viewerParams.cameraCD = new THREE.OrthographicCamera( screenWidth/-2, screenWidth/2, screenHeight/2, screenHeight/-2, -10000, 10000 );
	//viewerParams.cameraCD = new THREE.PerspectiveCamera( viewerParams.fov, aspect, viewerParams.zmin, viewerParams.zmax);
	viewerParams.cameraCD.position.z = 100;
	viewerParams.cameraCD.up.set(0, -1, 0);
	viewerParams.sceneCD.add(viewerParams.cameraCD);  
}

/* HELPER FUNCTIONS */
// makeViewer ->
// continuously check if viewerParams attributes that
// should be initialized here are null, if so, keep waiting
function confirmViewerInit(){
	var keys = ["partsKeys", "PsizeMult", "plotNmax", "decimate", "stereoSepMax", "friction", "Pcolors", "showParts", "showVel", "animateVel", "velopts", "velType", "ckeys", "colormapVals", "colormapLims", "colormapVariable", "colormap", "showColormap", "fkeys", "filterVals", "filterLims", "renderer", "scene", "controls","camera","parts"];

	var ready = true;
	keys.forEach(function(k,i){
		if (viewerParams[k] == null) ready = false;
	});

	if (viewerParams.parts == null){
		ready = false;
	} else {
		var partsVals = ["Coordinates_flat"]
		if (viewerParams.hasOwnProperty('partsKeys')){
			viewerParams.partsKeys.forEach(function(p){
				partsVals.forEach(function(k,i){
					if (viewerParams.parts[p][k] == null) ready = false;
				});
			})
		}
	}

	return ready;
}

// makeViewer ->
function sendInitGUI(prepend=[], append=[]){
	//general particle settings
	console.log('Sending init to GUI', viewerParams);

	var forGUI = prepend;
	forGUI.push({'setGUIParamByKey':[false,"GUIready"]});
	forGUI.push({'setGUIParamByKey':[viewerParams.partsKeys, "partsKeys"]});
	forGUI.push({'setGUIParamByKey':[viewerParams.PsizeMult, "PsizeMult"]});
	forGUI.push({'setGUIParamByKey':[viewerParams.plotNmax, "plotNmax"]});
	forGUI.push({'setGUIParamByKey':[viewerParams.decimate, "decimate"]});
	forGUI.push({'setGUIParamByKey':[viewerParams.Pcolors, "Pcolors"]});
	forGUI.push({'setGUIParamByKey':[viewerParams.showParts, "showParts"]});
	forGUI.push({'setGUIParamByKey':[viewerParams.parts.options.UIdropdown, "useDropdown"]});
	forGUI.push({'setGUIParamByKey':[viewerParams.parts.options.UIcolorPicker, "useColorPicker"]});
	forGUI.push({'setGUIParamByKey':[viewerParams.boxSize, "boxSize"]});

	//for velocities
	forGUI.push({'setGUIParamByKey':[viewerParams.showVel, "showVel"]});
	forGUI.push({'setGUIParamByKey':[viewerParams.velopts, "velopts"]});
	forGUI.push({'setGUIParamByKey':[viewerParams.velType, "velType"]});
	forGUI.push({'setGUIParamByKey':[viewerParams.velVectorWidth, "velVectorWidth"]});
	forGUI.push({'setGUIParamByKey':[viewerParams.velGradient, "velGradient"]});
	forGUI.push({'setGUIParamByKey':[viewerParams.animateVel, "animateVel"]});
	forGUI.push({'setGUIParamByKey':[viewerParams.animateVelDt, "animateVelDt"]});
	forGUI.push({'setGUIParamByKey':[viewerParams.animateVelTmax, "animateVelTmax"]});
	forGUI.push({'setGUIParamByKey':[viewerParams.blendingOpts, "blendingOpts"]});
	forGUI.push({'setGUIParamByKey':[viewerParams.blendingMode, "blendingMode"]});
	var haveVelocities = {};
	viewerParams.partsKeys.forEach(function(p){
		haveVelocities[p] = false;
		if (viewerParams.parts[p].Velocities_flat != null){
			haveVelocities[p] = true;
		}
	});
	forGUI.push({'setGUIParamByKey':[haveVelocities,"haveVelocities"]});

	//for colormap
	forGUI.push({'setGUIParamByKey':[viewerParams.ckeys,"ckeys"]});
	forGUI.push({'setGUIParamByKey':[viewerParams.colormapVals, "colormapVals"]});
	forGUI.push({'setGUIParamByKey':[viewerParams.colormapLims, "colormapLims"]});
	forGUI.push({'setGUIParamByKey':[viewerParams.colormapVariable, "colormapVariable"]});
	forGUI.push({'setGUIParamByKey':[viewerParams.colormap, "colormap"]});
	forGUI.push({'setGUIParamByKey':[viewerParams.showColormap, "showColormap"]});
	var haveColormap = {};
	var haveColormapSlider = {};
	viewerParams.partsKeys.forEach(function(p){
		haveColormap[p] = false;
		haveColormapSlider[p] = {};
		viewerParams.ckeys[p].forEach(function(ck){
			haveColormapSlider[p][ck] = false;
			if (viewerParams.parts[p][ck] != null){
				haveColormap[p] = true;
				haveColormapSlider[p][ck] = true;
			}
		});
	});
	forGUI.push({'setGUIParamByKey':[haveColormap,"haveColormap"]});
	forGUI.push({'setGUIParamByKey':[haveColormapSlider,"haveColormapSlider"]});

	//for filters
	forGUI.push({'setGUIParamByKey':[viewerParams.fkeys,"fkeys"]});
	forGUI.push({'setGUIParamByKey':[viewerParams.filterVals,"filterVals"]});
	forGUI.push({'setGUIParamByKey':[viewerParams.filterLims,"filterLims"]});
	forGUI.push({'setGUIParamByKey':[viewerParams.invertFilter,"invertFilter"]});
	var haveFilter = {};
	var haveFilterSlider = {};
	viewerParams.partsKeys.forEach(function(p){
		haveFilter[p] = false;
		haveFilterSlider[p] = {};
		forGUI.push({'setGUIParamByKey':[viewerParams.parts[p].currentlyShownFilter,"currentlyShownFilter",p]});
		viewerParams.fkeys[p].forEach(function(fk){
			haveFilterSlider[p][fk] = false;
			if (viewerParams.parts[p][fk] != null){
				haveFilter[p] = true;
				haveFilterSlider[p][fk] = true;
			}
		});
	});
	forGUI.push({'setGUIParamByKey':[haveFilter,"haveFilter"]});
	forGUI.push({'setGUIParamByKey':[haveFilterSlider,"haveFilterSlider"]});

	//for camera
	forGUI.push({'setGUIParamByKey':[viewerParams.stereoSepMax, "stereoSepMax"]});
	forGUI.push({'setGUIParamByKey':[viewerParams.friction, "friction"]});
	forGUI.push({'setGUIParamByKey':[viewerParams.useTrackball, "useTrackball"]});
	forGUI.push({'setGUIParamByKey':[viewerParams.useStereo, "useStereo"]});
	forGUI.push({'setGUIParamByKey':[viewerParams.renderWidth,"renderWidth"]});
	forGUI.push({'setGUIParamByKey':[viewerParams.renderHeight,"renderHeight"]});

	forGUI.push({'setGUIParamByKey':[viewerParams.reset,"reset"]});

	forGUI.push({'setGUIParamByKey':[viewerParams.camera.position, "cameraPosition"]});
	forGUI.push({'setGUIParamByKey':[viewerParams.camera.rotation, "cameraRotation"]});
	forGUI.push({'setGUIParamByKey':[viewerParams.camera.up, "cameraUp"]});
	var xx = new THREE.Vector3(0,0,0);
	viewerParams.camera.getWorldDirection(xx);
	forGUI.push({'setGUIParamByKey':[xx, "cameraDirection"]});
	if (viewerParams.useTrackball) forGUI.push({'setGUIParamByKey':[viewerParams.controls.target, "controlsTarget"]});

	forGUI.push({'updateUICenterText':null});
	forGUI.push({'updateUICameraText':null});
	forGUI.push({'updateUIRotText':null});

	//if (viewerParams.usingSocket && !viewerParams.local) forGUI.push({'updateGUICamera':null});
	if (viewerParams.usingSocket && !viewerParams.local) forGUI.push({'setGUIParamByKey':[true, "cameraNeedsUpdate"]});

	forGUI.push({'setGUIParamByKey':[viewerParams.haveOctree,"haveOctree"]});
	forGUI.push({'setGUIParamByKey':[viewerParams.haveAnyOctree,"haveAnyOctree"]});
	if (viewerParams.haveAnyOctree) {
		forGUI.push({'setGUIParamByKey':[viewerParams.octree.memoryLimit,"octreeMemoryLimit"]});
		forGUI.push({'setGUIParamByKey':[viewerParams.octree.normCameraDistance,"octreeNormCameraDistance"]});
		}
	append.forEach(function(x,i){
		forGUI.push(x);
	})

	forGUI.push({'setGUIParamByKey':[true,"GUIready"]});

	sendToGUI(forGUI);

	//ready to create GUI
	console.log("sent all inits to GUI", forGUI)

}

// callLoadData ->
function loadData(callback, prefix="", internalData=null, initialLoadFrac=0){

	viewerParams.parts = {};
	viewerParams.parts.totalSize = 0.;
	viewerParams.parts.count = {};


	viewerParams.partsKeys = Object.keys(viewerParams.filenames);
	viewerParams.partsKeys.forEach( function(p, i) {
		viewerParams.parts.count[p] = 0;
		viewerParams.haveOctree[p] = false;
		viewerParams.filenames[p].forEach( function(f, j) {
			var amt = 0;
			if (f.constructor == Array) amt = parseFloat(f[1]);
			else if (j == 1) amt = parseFloat(f);

			if (amt > 0) {
				viewerParams.parts.totalSize += amt;
				viewerParams.parts.count[p] += amt;
			} 
		});
	});

	viewerParams.partsKeys.forEach( function(p, i) {
		// initialize this particle dictionary
		viewerParams.parts[p] = {};

		// default that no particle groups have an octree
		viewerParams.haveOctree[p] = false

		// loop through each of the files to open
		viewerParams.filenames[p].forEach( function(f, j) {
			// passed data through flask, not an actual filename
			if (internalData){
				console.log('==== compiling internal data', f)
				Object.keys(internalData).forEach(function(key,k){
					//if I was sent a prefix, this could be simplified
					// TODO should handle passing binary data
					if (key.includes(f[0])) compileJSONData(internalData[key], p, callback, initialLoadFrac)
				})
				if (internalData && i == viewerParams.partsKeys.length - 1 && j == viewerParams.filenames[p].length - 1) viewerParams.newInternalData = {};

			} 
			// passed an actual file, let's read it
			else {
				// determine what sort of "file" i was passed
				//  i.e. where is the actual file name 
				// 	ABG NOTE: (not sure why f.constructor might be an array?) 
				var readf = null;
				if (f.constructor == Array) readf = "data/"+f[0];
				else if (j == 0) readf = "data/"+f;

				// alright, let's go ahead and read the file
				if (readf != null){
					// read JSON files (including octree.json files
					//  which reference .fftree files. Those are loaded
					//  separately on demand.)
					if (readf.toLowerCase().includes('.json')){
						d3.json(prefix+readf, function(foo) {
							compileJSONData(foo, p, callback, initialLoadFrac);
						});
					}
					// read binary .ffly files
					else if (readf.toLowerCase().includes('.ffly' )){
						loadFFLYKaitai(prefix+readf, function(foo){
							compileFFLYData(foo, p, callback, initialLoadFrac)}
						);
					}
				}
			}
		});
	});
}

// callCompileData ->
function compileJSONData(data, p, callback, initialLoadFrac=0){
	Object.keys(data).forEach(function(k, jj) {
		//console.log("k = ", k, jj)
		if (viewerParams.parts[p].hasOwnProperty(k)){
			viewerParams.parts[p][k] = viewerParams.parts[p][k].concat(data[k]);
			//console.log('appending', k, p, viewerParams.parts[p])

		} else {
			viewerParams.parts[p][k] = data[k];
			//console.log('creating', k, p, viewerParams.parts[p], data[k])
		}
	});

	// did we just load an octree.json file? let's initialize the octree then.
	if (data.hasOwnProperty('octree')) abg_initOctree(p,data);


	var num = 0;
	if (!viewerParams.counting){
		var num = countParts()
		var frac = (num/viewerParams.parts.totalSize);
		if (viewerParams.parts.totalSize == 0) frac = 1.;
		var loadfrac = frac*(1. - initialLoadFrac) + initialLoadFrac;
		//some if statment like this seems necessary.  Otherwise the loading bar doesn't update (I suppose from too many calls)
		if (loadfrac - viewerParams.loadfrac > 0.1 || loadfrac == 1){
			viewerParams.loadfrac = loadfrac;
			updateLoadingBar();
		}
		//console.log('in compile JSON data', p, data, viewerParams.counting, countParts(),'loadfrac', loadfrac)
	}
	if ('options' in viewerParams.parts){
		// we're done loading!
		if (countParts() ==  viewerParams.parts.totalSize && viewerParams.parts.options.loaded){

			var index = viewerParams.partsKeys.indexOf('options');
			if (index > -1) {
				viewerParams.partsKeys.splice(index, 1);
				viewerParams.parts.options0 = JSON.parse(JSON.stringify(viewerParams.parts.options));
			}

			callback(); 
		}
	}
}

// read a file, convert to a blob, and then pass the kaitai struct
//  to be translated into the viewerParams!
function loadFFLYKaitai(fname,callback){
	// initialize a FileReader object
	var binary_reader = new FileReader;
	// get local file
	fetch(fname)
		.then(res => res.blob()) // convert to blob
		.then(blob =>{ 
		// interpret blob as an "ArrayBuffer" (basic binary stream)
		binary_reader.readAsArrayBuffer(blob)
		// wait until loading finishes, then call function
		binary_reader.onloadend = function () {
			// convert ArrayBuffer to FireflyFormat
			kaitai_format = new FireflyFormat1(
				new KaitaiStream(binary_reader.result));
			// call compileFFLYData as a callback
			callback(kaitai_format);
		}
	});
};

// translate the katai format to viewerParams
function compileFFLYData(data, p, callback, initialLoadFrac=0){
	var hasVelocities = data.fireflyHeader.hasVelocities;
	var this_parts = viewerParams.parts[p];
	if (!data.hasOwnProperty('coordinatesFlat')) console.log("Invalid particle group data",data);
	else {
		// need to initialize various arrays that would've just been copied from the JSON
		if (!this_parts.hasOwnProperty('Coordinates_flat')){
			this_parts.Coordinates_flat = [];
			if (hasVelocities) this_parts.Velocities_flat = [];
			this_parts.filterKeys = [];
			this_parts.colormapKeys = [];
			// TODO hook this up for choosing which variable to scale points by
			this_parts.radiusFlags = [];
			this_parts.doSPHrad = Array(false);

			// initialize scalar field arrays and corresponding flags
			for (i=0; i < data.fireflyHeader.fieldNames.length; i++){
				field_name = data.fireflyHeader.fieldNames[i].fieldName
				this_parts[field_name] = [];
				if (data.fireflyHeader.filterFlags.buffer[i]) this_parts.filterKeys.push(field_name);
				if (data.fireflyHeader.colormapFlags.buffer[i]) this_parts.colormapKeys.push(field_name);
				if (data.fireflyHeader.radiusFlags.buffer[i]) this_parts.radiusKeys.push(field_name);
			}
		} // if (!this_parts.hasOwnProperty)('Coordinates_flat'))
		this_parts.Coordinates_flat = this_parts.Coordinates_flat.concat(data.coordinatesFlat.flatVectorData.data.values);
		// only load velocities if we actually have them
		if (hasVelocities) this_parts.Velocities_flat = this_parts.Velocities_flat.concat(data.velocitiesFlat.flatVectorData.data.values);

		// and now load the scalar field data
		for (i=0; i < data.fireflyHeader.nfields; i++){
			field_name = data.fireflyHeader.fieldNames[i].fieldName
			this_parts[field_name] = this_parts[field_name].concat(
				data.scalarFields[i].fieldData.data.values
			);
		}
	}
	var num = 0;
	if (!viewerParams.counting){
		var num = countParts()
		var frac = (num/viewerParams.parts.totalSize);
		if (viewerParams.parts.totalSize == 0) frac = 1.;
		var loadfrac = frac*(1. - initialLoadFrac) + initialLoadFrac;
		//some if statment like this seems necessary.  Otherwise the loading bar doesn't update (I suppose from too many calls)
		if (loadfrac - viewerParams.loadfrac > 0.1 || loadfrac == 1){
			viewerParams.loadfrac = loadfrac;
			updateLoadingBar();
		}
		//console.log('in compile FFLY data', p, data, viewerParams.counting, countParts(),'loadfrac', loadfrac)
	}

	if ('options' in viewerParams.parts){
		//console.log(d3.selectAll('#loadingRect').node().getBoundingClientRect().width)
		//console.log("counting", countParts(), viewerParams.parts.totalSize, viewerParams.loadfrac)
		if (countParts() ==  viewerParams.parts.totalSize && viewerParams.parts.options.loaded){
			//console.log("here")

			var index = viewerParams.partsKeys.indexOf('options');
			if (index > -1) {
				viewerParams.partsKeys.splice(index, 1);
				viewerParams.parts.options0 = JSON.parse(JSON.stringify(viewerParams.parts.options));
			}

			//if (viewerParams.haveAnyOctree) addKeysForOctree();

			callback(); 
		}
	}
}


// compileJSONData ->
function countParts(){
	var num = 0.;
	viewerParams.counting = true;
	viewerParams.partsKeys.forEach( function(p, i) {
		if (viewerParams.parts.hasOwnProperty(p)){
			// count the particles that have already been loaded,
			//  safe to assume they have coordinates.
			if (viewerParams.parts[p].hasOwnProperty('Coordinates_flat')){
				num += viewerParams.parts[p].Coordinates_flat.length/3;
			}
		}
		if (i == viewerParams.partsKeys.length - 1) viewerParams.counting = false;
	})
	return num;
}

// callLoadData -> , connectViewerSocket ->
function drawLoadingBar(){
	d3.select('#loadDataButton').style('display','none');
	d3.select('#selectStartupButton').style('display','none');

	var screenWidth = parseFloat(window.innerWidth);

	//Make an SVG Container
	var splash = d3.select("#splashdivLoader")

	splash.selectAll('svg').remove();

	var svg = splash.append("svg")
		.attr("width", screenWidth)
		.attr("height", viewerParams.loadingSizeY);

	viewerParams.svgContainer = svg.append("g")


	viewerParams.svgContainer.append("rect")
		.attr('id','loadingRectOutline')
		.attr("x", (screenWidth - viewerParams.loadingSizeX)/2)
		.attr("y", 0)
		.attr("width",viewerParams.loadingSizeX)
		.attr("height",viewerParams.loadingSizeY)
		.attr('fill','rgba(0,0,0,0)')
		.attr('stroke','var(--logo-color1)')
		.attr('stroke-width', '3')

	viewerParams.svgContainer.append("rect")
		.attr('id','loadingRect')
		.attr("x", (screenWidth - viewerParams.loadingSizeX)/2)
		.attr("y", 0)//(screenHeight - sizeY)/2)
		.attr("height",viewerParams.loadingSizeY)
		.attr('fill','var(--logo-color1)')
		.attr("width",viewerParams.loadingSizeX*viewerParams.loadfrac);


	window.addEventListener('resize', moveLoadingBar);

}

// drawLoadingBar ->
function moveLoadingBar(){
	var screenWidth = parseFloat(window.innerWidth);
	d3.selectAll('#loadingRectOutline').attr('x', (screenWidth - viewerParams.loadingSizeX)/2);
	d3.selectAll('#loadingRect').attr('x', (screenWidth - viewerParams.loadingSizeX)/2);
}

// compileJSONData ->
function updateLoadingBar(){
	//console.log(viewerParams.loadfrac, viewerParams.loadingSizeX*viewerParams.loadfrac)
	d3.selectAll('#loadingRect').transition().attr("width", viewerParams.loadingSizeX*viewerParams.loadfrac);

}

// initPVals -> 
function calcMinMax(p,key, addFac = true){
	var i=0;
	min = viewerParams.parts[p][key][i];
	max = viewerParams.parts[p][key][i];
	for (i=0; i< viewerParams.parts[p][key].length; i++){
		min = Math.min(min, viewerParams.parts[p][key][i]);
		max = Math.max(max, viewerParams.parts[p][key][i]);
	}
	if (addFac){
		//need to add a small factor here because of the precision of noUIslider
		min -= 0.001;
		max += 0.001;
	}
	return {"min":min, "max":max}
}

// initScene -> 
function setCenter(coords_flat){
	var sum = [0., 0., 0.];
	var nparts = coords_flat.length/3;
	for( var i = 0; i < nparts; i++ ){
		sum[0] += coords_flat[3*i];
		sum[1] += coords_flat[3*i+1];
		sum[2] += coords_flat[3*i+2];
	}

	// guard against divide by 0 error
	viewerParams.center = new THREE.Vector3(sum[0], sum[1], sum[2]);
	if (coords_flat.length > 0) viewerParams.center.divideScalar(coords_flat.length/3); 

	setBoxSize(coords_flat);

}

// setCenter ->
function setBoxSize(coords_flat){
	var fee, foo;
	var nparts = coords_flat.length/3;
	for( var i = 0; i < nparts; i++ ){
		foo = new THREE.Vector3(coords_flat.slice(3*i,3*(i+1)))
		fee = viewerParams.center.distanceTo(foo);
		if (fee > viewerParams.boxSize){
			viewerParams.boxSize = fee;
		}
	}
}

// applyOptions -> 
function calcVelVals(p){
	viewerParams.parts[p].VelVals = [];
	viewerParams.parts[p].magVelocities = [];
	viewerParams.parts[p].NormVel = [];
	var mag, angx, angy, v;
	var max = -1.;
	var min = 1.e20;
	var vdif = 1.;
	for (var i=0; i<viewerParams.parts.count[p]; i++){
		v = viewerParams.parts[p].Velocities_flat.slice(3*i,3*(i+1));
		mag = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
		angx = Math.atan2(v[1],v[0]);
		angy = Math.acos(v[2]/mag);
		if (mag > max){
			max = mag;
		}
		if (mag < min){
			min = mag;
		}
		viewerParams.parts[p].VelVals.push([v[0],v[1],v[2]]);
		viewerParams.parts[p].magVelocities.push(mag);
	}
	vdif = Math.min(max - min, viewerParams.maxVrange);
	for (var i=0; i<viewerParams.parts.count[p]; i++){
		viewerParams.parts[p].NormVel.push( THREE.Math.clamp((viewerParams.parts[p].magVelocities[i] - min) / vdif, 0., 1.));
	}
}

// initControls ->
function sendCameraInfoToGUI(foo, updateCam=false){

	var xx = new THREE.Vector3(0,0,0);
	viewerParams.camera.getWorldDirection(xx);

	var forGUI = [];
	forGUI.push({'setGUIParamByKey':[viewerParams.camera.position, "cameraPosition"]});
	forGUI.push({'setGUIParamByKey':[viewerParams.camera.rotation, "cameraRotation"]});
	forGUI.push({'setGUIParamByKey':[viewerParams.camera.up, "cameraUp"]});
	forGUI.push({'setGUIParamByKey':[xx, "cameraDirection"]});
	if (viewerParams.useTrackball) forGUI.push({'setGUIParamByKey':[viewerParams.controls.target, "controlsTarget"]});

	forGUI.push({'updateUICenterText':null});
	forGUI.push({'updateUICameraText':null});
	forGUI.push({'updateUIRotText':null});

	if (updateCam) forGUI.push({'updateGUICamera':null});

	sendToGUI(forGUI);
}

//for fly controls
document.addEventListener("keydown", sendCameraInfoToGUI);

// called numerous times outside this file
//check if the data is loaded
function clearloading(){
	viewerParams.loaded = true;
	viewerParams.reset = false;

	//show the rest of the page
	d3.select("#ContentContainer").style("visibility","visible")

	console.log("loaded")
	d3.select("#loader").style("display","none")
	if (viewerParams.local){
		d3.select("#splashdiv5").text("Click to begin.");
	} else {
		showSplash(false);
	}

}

// not sure where this is called
function updateViewerCamera(){
	if (viewerParams.useTrackball) viewerParams.controls.target = new THREE.Vector3(viewerParams.controlsTarget.x, viewerParams.controlsTarget.y, viewerParams.controlsTarget.z);

	if (viewerParams.camera){
		viewerParams.camera.position.set(viewerParams.cameraPosition.x, viewerParams.cameraPosition.y, viewerParams.cameraPosition.z);
		viewerParams.camera.rotation.set(viewerParams.cameraRotation._x, viewerParams.cameraRotation._y, viewerParams.cameraRotation._z);
		viewerParams.camera.up.set(viewerParams.cameraUp.x, viewerParams.cameraUp.y, viewerParams.cameraUp.z);
	}
	//console.log(viewerParams.camera.position, viewerParams.camera.rotation, viewerParams.camera.up);
}

function blankCallback(){
	console.log('blank callback')
}

function createOctreeLoadingBar(){
	var height = 16;
	var width = 215;
	var offset = 5;
	var margin = 10;

	var svg = d3.select('body').append('svg')
		.style('position','absolute')
		.style('left','0px')
		.style('bottom','0px')
		.attr('width', (width + 2*margin + 100) + 'px')
		.attr('height', height + 'px') //will be adjusted below
		//.style('transform', 'translate(10px,' + (window.innerHeight - height - 10)+'px)')

	//count to get the full size of the SVG
	var nRects = 0;
	viewerParams.partsKeys.forEach(function(p){
		if (viewerParams.haveOctree[p]){
			viewerParams.octree.loadingCount[p] = [0,0]; //will be updated during rendering

			svg.append('rect')
				.attr('id',p + 'octreeLoadingOutline')
				.attr('x', '10px')
				.attr('y', (nRects*(height + offset) + margin) + 'px')
				.attr('width',width + 'px')
				.attr('height',height + 'px')
				.attr('fill','rgba(0,0,0,0)')
				.attr('stroke','#d3d3d3')
				.attr('stroke-width', '1')
			svg.append('rect')
				.attr('id',p + 'octreeLoadingFill')
				.attr('class','octreeLoadingFill')
				.attr('x', '10px')
				.attr('y', (nRects*(height + offset) + margin) + 'px')
				.attr('width','0px') //will be updated
				.attr('height',height + 'px')
				.attr('fill','rgb(' + (255*viewerParams.Pcolors[p][0]) + ',' + (255*viewerParams.Pcolors[p][1]) + ',' + (255*viewerParams.Pcolors[p][2]) + ')')
			svg.append('text')
				.attr('id',p + 'octreeLoadingText')
				.attr('class','octreeLoadingText')
				.attr('x', (width + margin + offset) + 'px')
				.attr('y', (nRects*(height + offset) + margin + 0.75*height) + 'px')
				.attr('fill','rgb(' + (255*viewerParams.Pcolors[p][0]) + ',' + (255*viewerParams.Pcolors[p][1]) + ',' + (255*viewerParams.Pcolors[p][2]) + ')')
				.style('font-size', (0.75*height) + 'px')
				.text(p + ' (' + viewerParams.octree.loadingCount[p][1] + '/' + viewerParams.octree.loadingCount[p][0] + ')')				
			nRects += 1;
		}
	})

	svg.attr('height', (nRects*(height + offset) + 2.*margin) + 'px') 

}
function updateOctreeLoadingBar(){
	viewerParams.partsKeys.forEach(function(p){
		if (viewerParams.haveOctree[p]){
			var width = parseFloat(d3.select('#' + p + 'octreeLoadingOutline').attr('width'));
			if (viewerParams.octree.loadingCount[p][0] > 0){
				var frac = THREE.Math.clamp(viewerParams.octree.loadingCount[p][1]/viewerParams.octree.loadingCount[p][0], 0, 1);
				//var frac = Math.max(viewerParams.octree.loadingCount[p][1]/viewerParams.octree.loadingCount[p][0], 0);
				//console.log('loading',p, width,viewerParams.octree.loadingCount[p], frac)
				d3.select('#' + p + 'octreeLoadingFill').transition().attr('width', (width*frac) + 'px');
				d3.select('#' + p + 'octreeLoadingText').text(p + ' (' + viewerParams.octree.loadingCount[p][1] + '/' + viewerParams.octree.loadingCount[p][0] + ')');
			}
		}
	})

}


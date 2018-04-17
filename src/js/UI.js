//reset to the initial Options file
function resetToOptions()
{
	//reset all the parts specific values to the initial ones
	initPVals(reset = true);
	
	//redo init, but only the camera bits (maybe could streamline this and init by using the functions below?)
    init(reset = true);

    //destroy the particle portion of the UI and recreate it (simplest option)
	d3.select('#particleUI').html("");
    createUI(reset = true);

}

//check whether the center is locked or not
function checkCenterLock(box)
{

	params.controls.dispose();
	if (box.checked) {
		params.rotatecamera = true;
	} else {
		params.rotatecamera = false;
	}
	initControls();

}

//reset the camera position to whatever is saved in the options parameters
//NOTE: if the cameraRotation is set, then the controls become fly controls
function resetCamera() 
{

    var screenWidth = window.innerWidth;
    var screenHeight = window.innerHeight;
    var aspect = screenWidth / screenHeight;
    params.camera = new THREE.PerspectiveCamera( params.fov, aspect, params.zmin, params.zmax);
    params.scene.add(params.camera);

    params.camera.position.set(params.parts.options.camera[0], params.parts.options.camera[1], params.parts.options.camera[2]);
    params.camera.lookAt(params.scene.position);  
    if (params.parts.options.hasOwnProperty('cameraRotation')){
        params.rotatecamera = false;
        elm = document.getElementById("CenterCheckBox");
        elm.checked = false;
        params.camera.rotation.set(params.parts.options.cameraRotation[0], params.parts.options.cameraRotation[1], params.parts.options.cameraRotation[2]);
    }

	params.controls.dispose();
    initControls(center = params.center);


}

//reset the camera center.  Can be useful when switching back and forth between trackball and fly controls
function recenterCamera() 
{
	initControls(center = params.center);
}

//replace the current camera settings in options with the current camera position and rotation (to return here upon clicking reset)
//NOTE: with a reset, this will set the controls to fly controls
function saveCamera() 
{

    if (!params.parts.options.hasOwnProperty('camera')){
		params.parts.options.camera = [0,0,0];
	}
	params.parts.options.camera[0] = params.camera.position.x;
	params.parts.options.camera[1] = params.camera.position.y;
	params.parts.options.camera[2] = params.camera.position.z;

 //    if (!params.parts.options.hasOwnProperty('cameraRotation')){
	// 	params.parts.options.cameraRotation = [0,0,0];
	// }
	if (params.parts.options.hasOwnProperty('cameraRotation')){
	    params.parts.options.cameraRotation[0] = params.camera.rotation.x;
	    params.parts.options.cameraRotation[1] = params.camera.rotation.y;
	    params.parts.options.cameraRotation[2] = params.camera.rotation.z;
	}
}

function checkVelBox(box)
{
	var pID = box.id.slice(0, -11)
	params.showVel[pID] = false;
	if (box.checked){
		params.showVel[pID] = true;
	}

}

//functions to check sizes of particles
function checkColor(event, color)
{
	rgb = color.toRgb();
	var pID = event.id.slice(0,-11); // remove  "ColorPicker" from id
	params.Pcolors[pID] = [rgb.r/255., rgb.g/255., rgb.b/255., rgb.a];
}


/////////////////////////////////////////////
// Filter sliders
function setFSliderHandle(i, value, parent, reset=false) {

	// I need a better way to do this!
	var fpos = parent.id.indexOf('_FK_');
	var epos = parent.id.indexOf('_END_');
	var sl = parent.id.length;
	var p = parent.id.slice(0, fpos - sl);
	var fk = parent.id.slice(fpos + 4, epos - sl);
	params.filterLims[p][fk][i] = value;

	//reset the filter limits if there is a text entry
	if (reset){
		var fmin = parseFloat(params.filterLims[p][fk][0]);
		var fmax = parseFloat(params.filterLims[p][fk][1]);
		var max = parseFloat(parent.noUiSlider.options.range.max[0]);
		var min = parseFloat(parent.noUiSlider.options.range.min[0]);

		if (i == 0){
			parent.noUiSlider.updateOptions({
				range: {
					'min': [parseFloat(value)],
					'max': [max]
				}
			});
		}
		if (i == 1){
			parent.noUiSlider.updateOptions({
				range: {
					'min': [min],
					'max': [parseFloat(value)]
				}
			});
		}
	}

	var r = parent.noUiSlider.get()
	r[i] = value;
	parent.noUiSlider.set(r);



	params.updateFilter[p] = true;
	mouseDown = false; 
}

// Listen to keydown events on the input field.
function handleFSliderText(input, handle) 
{
	input.addEventListener('change', function(){
		setFSliderHandle(handle, this.value, this.parent);
	});
	input.addEventListener('keydown', function( e ) {
		var values = input.parent.noUiSlider.get();
		var value = Number(values[handle]);
		// [[handle0_down, handle0_up], [handle1_down, handle1_up]]
		var steps = input.parent.noUiSlider.options.steps;
		// [down, up]
		var step = steps[handle];
		var position;
		// 13 is enter,
		// 38 is key up,
		// 40 is key down.
		switch ( e.which ) {
			case 13:
				setFSliderHandle(handle, this.value, input.parent, reset=true);
				break;
			case 38:
				// Get step to go increase slider value (up)
				// false = no step is set
				position = step[1];
				if ( position === false ) {
					position = 1;
				}
				// null = edge of slider
				if ( position !== null ) {
					setFSliderHandle(handle, value + position, input.parent, reset=false);
				}
				break;
			case 40:
				position = step[0];
				if ( position === false ) {
					position = 1;
				}
				if ( position !== null ) {
					setFSliderHandle(handle, value - position, input.parent, reset=false);
				}
				break;
		}
	});
};

function createFilterSliders(){

	var i = 0;
	var j = 0;
	for (i=0; i<params.partsKeys.length; i++){
		p = params.partsKeys[i];
		if (params.parts.options.UIdropdown[p] == 1){

			params.SliderF[p] = {};
			params.SliderFmin[p] = {};
			params.SliderFmax[p] = {};
			params.SliderFinputs[p] = {};

			for (j=0; j<params.fkeys[p].length; j++){
				var fk = params.fkeys[p][j]
				params.SliderF[p][fk] = document.getElementById(p+'_FK_'+fk+'_END_FilterSlider');
				params.SliderFmin[p][fk] = document.getElementById(p+'_FK_'+fk+'_END_FilterMinT');
				params.SliderFmax[p][fk] = document.getElementById(p+'_FK_'+fk+'_END_FilterMaxT');
				if (params.SliderF[p][fk] != null && params.SliderFmin[p][fk] != null && params.SliderFmax[p][fk] != null && params.filterLims[p][fk] != null){
					if (params.SliderF[p][fk].noUiSlider) {
						params.SliderF[p][fk].noUiSlider.destroy();
					}
					params.SliderFinputs[p][fk] = [params.SliderFmin[p][fk], params.SliderFmax[p][fk]];
					params.SliderFinputs[p][fk][0].parent = params.SliderF[p][fk];
					params.SliderFinputs[p][fk][1].parent = params.SliderF[p][fk];
					min = parseFloat(params.filterLims[p][fk][0]);
					max = parseFloat(params.filterLims[p][fk][1]);

					noUiSlider.create(params.SliderF[p][fk], {
						start: [min, max],
						connect: true,
						tooltips: [false, false],
						steps: [[0.001,0.001],[0.001,0.001]],
						range: {
							'min': [min],
							'max': [max]
						},
						format: wNumb({
						decimals: 3
						})
					});
					params.SliderF[p][fk].noUiSlider.on('mouseup', mouseDown=false); 
					params.SliderF[p][fk].noUiSlider.on('update', function(values, handle) {
						var fpos = this.target.id.indexOf('_FK_');
						var epos = this.target.id.indexOf('_END_');
						var sl = this.target.id.length;
						var pp = this.target.id.slice(0, fpos - sl);
						var ffk = this.target.id.slice(fpos + 4, epos - sl);
						params.SliderFinputs[pp][ffk][handle].value = values[handle];
						params.filterLims[pp][ffk][handle] = values[handle];
						params.updateFilter[pp] = true;
						mouseDown = true;
					});

					params.SliderFinputs[p][fk].forEach(handleFSliderText);
				}
				var w = parseInt(d3.select('.FilterClass').style("width").slice(0,-2));
				d3.select('#'+p+'_FK_'+fk+'_END_FilterSlider').select('.noUi-base').style('width',w-10+"px");
			 	d3.select('#'+p+'_FK_'+fk+'_END_FilterSlider').select('.noUi-connect').style('border-radius','6px 0px 0px 6px');
			 	d3.select('#'+p+'_FK_'+fk+'_END_FilterSlider').select('.noUi-handle-lower').style('border-radius','6px 0px 0px 6px');

			}
		}
	}
}

/////////////////////////////////////////////
// N sliders
function setNSliderHandle(i, value, parent) {
	var r = [null];
	r[i] = value;
	parent.noUiSlider.set(value);
	var p = parent.id.slice(0, -8);
	params.plotNmax[p] = value;
	mouseDown = false; 
}

// Listen to keydown events on the input field.
// can I just use the same functions as for the filters?
function handleNSliderText(input, handle) 
{
	input.addEventListener('change', function(){
		setNSliderHandle(handle, this.value, this.parent);
	});
	input.addEventListener('keydown', function( e ) {
		var value = Number(input.parent.noUiSlider.get());
		var steps = input.parent.noUiSlider.options.steps;
		var step = steps[handle];
		switch ( e.which ) {
			case 13:
				setNSliderHandle(handle, this.value, input.parent);
				break;
			case 38:
				setNSliderHandle(handle, value + step, input.parent);
				break;
			case 40:
				setNSliderHandle(handle, value - step, input.parent);
				break;
		}
	});
};

function createNsliders(){

	var i = 0;
	var j = 0;
	for (i=0; i<params.partsKeys.length; i++){

		p = params.partsKeys[i];

		if (params.parts.options.UIdropdown[p] == 1){

			params.SliderN[p] = document.getElementById(p+'_NSlider');
			params.SliderNmax[p] = document.getElementById(p+'_NMaxT');
			if (params.SliderN[p] != null && params.SliderNmax[p] != null){
				params.SliderNInputs[p] = [params.SliderNmax[p]];
				params.SliderNInputs[p][0].parent = params.SliderN[p];
				min = 0;
				max = Math.round(params.parts[p].Coordinates.length/params.Decimate);

				noUiSlider.create(params.SliderN[p], {
					start: [max],
					connect: [true, false],
					tooltips: [false],
					steps: [1],
					range: {
						'min': [min],
						'max': [max]
					},
					format: wNumb({
					decimals: 0
					})
				});
				params.SliderN[p].noUiSlider.on('mouseup', mouseDown=false); 
				params.SliderN[p].noUiSlider.on('update', function(values, handle) {
					var pp = this.target.id.slice(0, -8);
					params.SliderNInputs[pp][handle].value = values[handle];
					params.plotNmax[pp] = parseInt(values[handle]);
					mouseDown = true;
				});

				params.SliderNInputs[p].forEach(handleNSliderText);
			}
			w = parseInt(d3.select('#'+p+'_NSlider').style('width').slice(0,-2));
			d3.select('#'+p+'_NSlider').select('.noUi-base').style('width',w-10+"px");
		}
	}
}

/////////////////////////////////////////////
// Psize sliders
function setPSliderHandle(i, value, parent) {
	var max = parent.noUiSlider.options.range.max[0];
	if (value > max){
		parent.noUiSlider.updateOptions({
			range: {
				'min': [0],
				'max': [parseFloat(value)]
			}
		});
	}
	var r = [null];
	r[i] = value;
	parent.noUiSlider.set(value);
	var p = parent.id.slice(0, -8);
	params.PsizeMult[p] = value;
	mouseDown = false; 

}

// Listen to keydown events on the input field.
// can I just use the same functions as for the filters?
function handlePSliderText(input, handle) 
{
	input.addEventListener('change', function(){
		setPSliderHandle(handle, this.value, this.parent);
	});
	input.addEventListener('keydown', function( e ) {
		var value = Number(input.parent.noUiSlider.get());
		var steps = input.parent.noUiSlider.options.steps;
		var step = steps[handle];
		//var max = max = document.getElementById(pID+"PRange").max;

		switch ( e.which ) {
			case 13:
				setPSliderHandle(handle, this.value, input.parent);
				break;
			case 38:
				setPSliderHandle(handle, value + step, input.parent);
				break;
			case 40:
				setPSliderHandle(handle, value - step, input.parent);
				break;
		}
	});
};

//need to allow this to update at large numbers
function createPsliders(){



	var i = 0;
	var j = 0;
	for (i=0; i<params.partsKeys.length; i++){
		p = params.partsKeys[i];

		params.SliderP[p] = document.getElementById(p+'_PSlider');
		params.SliderPmax[p] = document.getElementById(p+'_PMaxT');
		if (params.SliderP[p] != null && params.SliderPmax[p] != null){

			if (params.SliderP[p].noUiSlider) {
				params.SliderP[p].noUiSlider.destroy();
			}

			params.SliderPInputs[p] = [params.SliderPmax[p]];
			params.SliderPInputs[p][0].parent = params.SliderP[p];
			min = 0.;
			max = 5.;

			noUiSlider.create(params.SliderP[p], {
				start: [params.PsizeMult[p]],
				connect: [true, false],
				tooltips: false,
				steps: [0.1],
				range: {
					'min': [min],
					'max': [max]
				},
				format: wNumb({
				decimals: 1
				})
			});

			params.SliderP[p].noUiSlider.on('mouseup', mouseDown=false); 
			params.SliderP[p].noUiSlider.on('update', function(values, handle) {
				var pp = this.target.id.slice(0, -8);
				params.SliderPInputs[pp][handle].value = values[handle];
				params.PsizeMult[pp] = parseFloat(values[handle]);
				mouseDown = true;

			});

			params.SliderPInputs[p].forEach(handlePSliderText);
		}
		w = parseInt(d3.select('#'+p+'_PSlider').style('width').slice(0,-2));
		d3.select('#'+p+'_PSlider').select('.noUi-base').style('width',w-10+"px");
	}
}

/////////////////////////////////////////////
// Decimation slider
function setDSliderHandle(i, value, parent) {
	value = Math.max(1, parseFloat(value));

	var max = parseFloat(parent.noUiSlider.options.range.max[i]);
	if (value > max){
		parent.noUiSlider.updateOptions({
			range: {
				'min': [1],
				'max': [parseFloat(value)]
			}
		});
	}
	var val;
	for (i=0; i<params.partsKeys.length; i++){
		var p = params.partsKeys[i];
		max = Math.round(params.parts[p].Coordinates.length);
	 	val = parseFloat(params.SliderN[p].noUiSlider.get());
		params.SliderN[p].noUiSlider.updateOptions({
			range: {
				'min': [0],
				'max': [Math.round(max/value)]
			},
		});
		params.SliderN[p].noUiSlider.set(Math.min(max, val*params.Decimate/parseFloat(value)));
	}
	var r = [null];
	r[i] = value;
	parent.noUiSlider.set(value);
	params.Decimate = value;
	mouseDown = false; 

}

// Listen to keydown events on the input field.
// can I just use the same functions as for the filters?
function handleDSliderText(input, handle) 
{
	input.addEventListener('change', function(){
		setDSliderHandle(handle, this.value, this.parent);
	});
	input.addEventListener('keydown', function( e ) {
		var value = Number(input.parent.noUiSlider.get());
		var steps = input.parent.noUiSlider.options.steps;
		var step = steps[handle];
		//var max = max = document.getElementById(pID+"PRange").max;

		switch ( e.which ) {
			case 13:
				setDSliderHandle(handle, this.value, input.parent);
				break;
			case 38:
				setDSliderHandle(handle, value + step, input.parent);
				break;
			case 40:
				setDSliderHandle(handle, value - step, input.parent);
				break;
		}
	});
};

//need to allow this to update at large numbers
function createDslider(){

	params.SliderD = document.getElementById('DSlider');
	params.SliderDmax = document.getElementById('DMaxT');
	if (params.SliderD != null && params.SliderDmax != null){
		if (params.SliderD.noUiSlider) {
			params.SliderD.noUiSlider.destroy();
		}
		params.SliderDInputs = [params.SliderDmax];
		params.SliderDInputs[0].parent = params.SliderD;
		min = 1.;
		max = 100.;

		noUiSlider.create(params.SliderD, {
			start: [1],
			connect: [true, false],
			tooltips: false,
			steps: [1],
			range: {
				'min': [min],
				'max': [max]
			},
			format: wNumb({
			decimals: 0
			})
		});

		params.SliderD.noUiSlider.on('mouseup', mouseDown=false); 
		params.SliderD.noUiSlider.on('update', function(values, handle) {
			for (i=0; i<params.partsKeys.length; i++){
				var p = params.partsKeys[i];
				var max = Math.round(params.parts[p].Coordinates.length);
				if (params.parts.options.UIdropdown[p] == 1){
					var val = parseFloat(params.SliderN[p].noUiSlider.get());
					params.SliderN[p].noUiSlider.updateOptions({
						range: {
							'min': [0],
							'max': [Math.round(max/parseFloat(values[handle]))]
						}
					});
					params.SliderN[p].noUiSlider.set(Math.min(max, val*params.Decimate/parseFloat(values[handle])));
				}

			}

			params.SliderDInputs[handle].value = values[handle];
			params.Decimate = parseFloat(values[handle]);
			mouseDown = true;
		});

		params.SliderDInputs.forEach(handleDSliderText);
	}
	w = parseInt(d3.select("#DSlider").style("width").slice(0,-2));
	d3.select("#DSlider").select('.noUi-base').style('width',w-10+"px");
}


/////////////////////////////////////////////
// Friction slider
function setCFSliderHandle(i, value, parent) {
	value = Math.min(Math.max(0., parseFloat(value)),1.);

	parent.noUiSlider.set(value);
	if (params.rotatecamera){
		params.controls.dynamicDampingFactor = value;
	}
	mouseDown = false; 

}

// Listen to keydown events on the input field.
function handleCFSliderText(input, handle) 
{
	input.addEventListener('change', function(){
		setCFSliderHandle(handle, this.value, this.parent);
	});
	input.addEventListener('keydown', function( e ) {
		var value = Number(input.parent.noUiSlider.get());
		var steps = input.parent.noUiSlider.options.steps;
		var step = steps[handle];
		//var max = max = document.getElementById(pID+"PRange").max;

		switch ( e.which ) {
			case 13:
				setCFSliderHandle(handle, this.value, input.parent);
				break;
			case 38:
				setCFSliderHandle(handle, value + step, input.parent);
				break;
			case 40:
				setCFSliderHandle(handle, value - step, input.parent);
				break;
		}
	});
};

function createCFslider(){

	params.SliderCF = document.getElementById('CFSlider');
	params.SliderCFmax = document.getElementById('CFMaxT');
	if (params.SliderCF != null && params.SliderCFmax != null){
		if (params.SliderCF.noUiSlider) {
			params.SliderCF.noUiSlider.destroy();
		}
		params.SliderCFInputs = [params.SliderCFmax];
		params.SliderCFInputs[0].parent = params.SliderCF;
		min = 0.;
		max = 1.;

		noUiSlider.create(params.SliderCF, {
			start: [params.controls.dynamicDampingFactor],
			connect: [true, false],
			tooltips: false,
			steps: [0.01],
			range: {
				'min': [min],
				'max': [max]
			},
			format: wNumb({
				decimals: 2
			})
		});

		params.SliderCF.noUiSlider.on('mouseup', mouseDown=false); 
		params.SliderCF.noUiSlider.on('update', function(values, handle) {

			params.SliderCFInputs[handle].value = values[handle];
			var value = Math.min(Math.max(0., parseFloat(values[handle])),1.);
			if (params.rotatecamera){
				params.controls.dynamicDampingFactor = value;
			}
			mouseDown = true;
		});

		params.SliderCFInputs.forEach(handleCFSliderText);
	}
	w = parseInt(d3.select("#CFSlider").style("width").slice(0,-2));
	d3.select("#CFSlider").select('.noUi-base').style('width',w-10+"px");
}

function updateUICenterText()
{
	if (params.rotatecamera){
		document.getElementById("CenterXText").value = params.controls.target.x + params.center.x;
		document.getElementById("CenterYText").value = params.controls.target.y + params.center.y;
		document.getElementById("CenterZText").value = params.controls.target.z + params.center.z;
	} else {
		document.getElementById("CenterXText").value = 0;
		document.getElementById("CenterYText").value = 0;
		document.getElementById("CenterZText").value = 0;		
	}
}

/////////////////////////////////////////////
// Stereo Separation slider
function checkStereoLock(box)
{
	if (box.checked) {
		params.normalRenderer = params.renderer;
		params.renderer = params.effect;
		params.useStereo = true;
	} else {
		params.renderer = params.normalRenderer;
		params.renderer.setSize(window.innerWidth, window.innerHeight);
		params.useStereo = false;
	}
}
function setSSSliderHandle(i, value, parent) {
	var max = parent.noUiSlider.options.range.max[i];
	if (value > max){
		params.stereoSepMax = parseFloat(value);
		parent.noUiSlider.updateOptions({
			range: {
				'min': [0],
				'max': [parseFloat(value)]
			}
		});
	}
	value = Math.min(Math.max(0., parseFloat(value)),params.stereoSepMax);

	parent.noUiSlider.set(value);
	params.effect.setEyeSeparation(value);
	
	mouseDown = false; 

}

// Listen to keydown events on the input field.
function handleSSSliderText(input, handle) 
{
	input.addEventListener('change', function(){
		setSSSliderHandle(handle, this.value, this.parent);
	});
	input.addEventListener('keydown', function( e ) {
		var value = Number(input.parent.noUiSlider.get());
		var steps = input.parent.noUiSlider.options.steps;
		var step = steps[handle];
		//var max = max = document.getElementById(pID+"PRange").max;

		switch ( e.which ) {
			case 13:
				setSSSliderHandle(handle, this.value, input.parent);
				break;
			case 38:
				setSSSliderHandle(handle, value + step, input.parent);
				break;
			case 40:
				setSSSliderHandle(handle, value - step, input.parent);
				break;
		}
	});
};

function createSSslider(){

	params.sliderSS = document.getElementById('SSSlider');
	params.sliderSSmax = document.getElementById('SSMaxT');
	if (params.sliderSS != null && params.sliderSSmax != null){
		if (params.sliderSS.noUiSlider) {
			params.sliderSS.noUiSlider.destroy();
		}
		params.sliderSSInputs = [params.sliderSSmax];
		params.sliderSSInputs[0].parent = params.sliderSS;
		min = 0.;
		max = parseFloat(params.stereoSepMax);

		noUiSlider.create(params.sliderSS, {
			start: [params.stereoSep],
			connect: [true, false],
			tooltips: false,
			steps: [0.001],
			range: {
				'min': [min],
				'max': [max]
			},
			format: wNumb({
				decimals: 3
			})
		});

		params.sliderSS.noUiSlider.on('mouseup', mouseDown=false); 
		params.sliderSS.noUiSlider.on('update', function(values, handle) {

			params.sliderSSInputs[handle].value = values[handle];

			var value = Math.min(Math.max(0., parseFloat(values[handle])),params.stereoSepMax);
			params.effect.setEyeSeparation(value);
			mouseDown = true;
		});

		params.sliderSSInputs.forEach(handleSSSliderText);
	}
	w = parseInt(d3.select("#SSSlider").style("width").slice(0,-2));
	d3.select("#SSSlider").select('.noUi-base').style('width',w-10+"px");
}

function updateUICameraText()
{
    document.getElementById("CameraXText").value = params.camera.position.x + params.center.x;
    document.getElementById("CameraYText").value = params.camera.position.y + params.center.y;
    document.getElementById("CameraZText").value = params.camera.position.z + params.center.z;
}

function updateUIRotText()
{
    document.getElementById("RotXText").value = params.camera.rotation.x;
    document.getElementById("RotYText").value = params.camera.rotation.y;
    document.getElementById("RotZText").value = params.camera.rotation.z;

}


function checkText(input, event)
{

	var key=event.keyCode || event.which;
  	if (key==13){

        if (input.id == "CenterXText"){
        	params.center.x = parseFloat(input.value);
		}
        if (input.id == "CenterYText"){
        	params.center.y = parseFloat(input.value);
 		}
        if (input.id == "CenterZText"){
        	params.center.z = parseFloat(input.value);
 		}

        if (input.id == "CameraXText"){
        	params.camera.position.x = parseFloat(input.value) - params.center.x;
 		}
        if (input.id == "CameraYText"){
         	params.camera.position.y = parseFloat(input.value) - params.center.xy
 		}
        if (input.id == "CameraZText"){
         	params.camera.position.z = parseFloat(input.value) - params.center.z;
 		}


        if (input.id == "RotXText"){
        	params.camera.rotation.x = parseFloat(input.value)
 		}
        if (input.id == "RotYText"){
        	params.camera.rotation.y = parseFloat(input.value)
 		}
        if (input.id == "RotZText"){
        	params.camera.rotation.z = parseFloat(input.value)
 		}
		if (input.id == "RenderXText"){
			params.renderWidth = parseInt(input.value);
		}
		if (input.id == "RenderYText"){
			params.renderHeight = parseInt(input.value);
		}
	}

}

//function to check which types to plot
function checkPlotParts(checkbox)
{
	var type = checkbox.id.slice(-5); 
	if (type == 'Check'){	
		var pID = checkbox.id.slice(0,-5); // remove  "Check" from id
    	params.plotParts[pID] = false;
    	if (checkbox.checked){
       		params.plotParts[pID] = true;
    	}
    } 
}


var UIhidden = false;
function hideUI(x){
	x.classList.toggle("change");

	var UI = document.getElementById("UIhider");
	var UIc = document.getElementsByClassName("UIcontainer")[0];
	if (UIhidden){
		UI.setAttribute("style","visibility: visible;");
		UIc.setAttribute("style","border-style: solid;");
		UIhidden = false;
	} else {
		UI.setAttribute("style","visibility: hidden;");	
		UIc.setAttribute("style","border-style: none; margin-left:2px; margin-top:2px");
		UIhidden = true;	
	}
}



function getPi(pID){
	var i=0;
	for (i=0; i<params.partsKeys.length; i++){
		if (pID == params.partsKeys[i]){
			break;
		}
	}
	return i
}

function showFunction(handle) {
	var offset = 5;

//find the position in the partsKeys list
	var pID = handle.id.slice(0,-7); // remove  "Dropbtn" from id
	i = getPi(pID);
    document.getElementById(pID+"Dropdown").classList.toggle("show");

    var pdiv;
   	var ddiv = document.getElementById(pID+'Dropdown');
	var ht = parseFloat(ddiv.style.height.slice(0,-2)) + offset; //to take of "px"
	var pb = 0.;

    if (i < params.partsKeys.length-1){
	    pdiv = document.getElementsByClassName(params.partsKeys[i+1]+'Div')[0];
		if (params.gtoggle[pID]){
	    	pdiv.setAttribute("style","margin-top: "+ht + "px; ");
	    	params.gtoggle[pID] = false;	
	 	} else {
	 		pdiv.setAttribute("style","margin-top: 0 px; ");	
			params.gtoggle[pID] = true;
		}
	} else { // a bit clunky, but works with the current setup
		if (pID == "Camera"){
	    	c = document.getElementById("DecimationDiv");
	    	pb = 5;
			if (params.gtoggle[pID]){
				c.setAttribute('style','margin-top:'+(pb+ht-5)+'px');
				params.gtoggle[pID] = false;	

			} else {
				c.setAttribute('style','margin-top:'+pb+'px');	
				params.gtoggle[pID] = true;	
			}	
		} else { //for the last particle (to move the bottom of the container)
			c = document.getElementsByClassName("UIcontainer")[0];

			if (params.gtoggle[pID]){
				c.setAttribute('style','padding-bottom:'+(pb+ht-5)+'px');
				params.gtoggle[pID] = false;	

			} else {
				c.setAttribute('style','padding-bottom:'+pb+'px');	
				params.gtoggle[pID] = true;		
			}
		}
	}
}

function selectFilter() {
	var option = d3.select(this)
	    .selectAll("option")
	    .filter(function (d, i) { 
	        return this.selected; 
    });
	selectValue = option.property('value');

	var p = this.id.slice(0,-13)

	//console.log("in selectFilter", selectValue, this.id, p)
	for (var i=0; i<params.fkeys[p].length; i+=1){
		//console.log('hiding','#'+p+'_FK_'+params.fkeys[p][i]+'_END_Filter')
		d3.selectAll('#'+p+'_FK_'+params.fkeys[p][i]+'_END_Filter')
			.style('display','none');
	}
	//console.log('showing', '#'+p+'_FK_'+selectValue+'_END_Filter')
	d3.selectAll('#'+p+'_FK_'+selectValue+'_END_Filter')
		.style('display','inline');


};

function selectVelType() {
	var option = d3.select(this)
	    .selectAll("option")
	    .filter(function (d, i) { 
	        return this.selected; 
    });
	selectValue = option.property('value');

	var p = this.id.slice(0,-14)
	params.velType[p] = selectValue;
};


function createUI(reset = false){
	console.log("Creating UI");

//change the hamburger to the X to start
	if (! reset){
	 	var hamburger = document.getElementById('UItopbar');
	 	//hide the UI
		hideUI(hamburger);
	 	hamburger.classList.toggle("change");
	 }


	console.log(params.partsKeys)
	var UI = d3.select('#particleUI')
	    .selectAll('div')
		.data(params.partsKeys).enter()
		.append('div')
		.attr('class', function (d) { return "particleDiv "+d+"Div" }) //+ dropdown


	var i=0;
	var j=0;
	for (i=0; i<params.partsKeys.length; i++){
		d = params.partsKeys[i];

		var controls = d3.selectAll('div.'+d+'Div');

		controls.append('div')
			.attr('class','pLabelDiv')
			.text(function (d) { return d})
			
		var onoff = controls.append('label')
			.attr('class','switch');

		onoff.append('input')
			.attr('id',d+'Check')
			.attr('type','checkbox')
			.attr('autocomplete','off')
			.attr('checked','true')
			.attr('onchange','checkPlotParts(this)');

		onoff.append('span')
			.attr('class','slideroo');


		controls.append('div')
			.attr('id',d+'_PSlider')
			.attr('class','PSliderClass');

		controls.append('input')
			.attr('id',d+'_PMaxT')
			.attr('class', 'PMaxTClass')
			.attr('type','text');

		controls.append('input')
			.attr('id',d+'ColorPicker');

		if (params.parts.options.UIdropdown[d] == 1){
			controls.append('button')
				.attr('id', d+'Dropbtn')
				.attr('class', 'dropbtn')
				.attr('onclick','showFunction(this)')
				.html('&#x25BC');

			dropdown = controls.append('div')
				.attr('id',d+'Dropdown')
				.attr('class','dropdown-content');

			dNcontent = dropdown.append('div')
				.attr('class','NdDiv');

			dNcontent.append('span')
				.attr('class','pLabelDiv')
				.attr('style','width:20px')
				.text('N');

			dNcontent.append('div')
				.attr('id',d+'_NSlider')
				.attr('class','NSliderClass');

			dNcontent.append('input')
				.attr('id',d+'_NMaxT')
				.attr('class', 'NMaxTClass')
				.attr('type','text');

			var dheight = 30;

	//for velocity vectors

			if (params.parts[d].Velocities != null){
				dropdown.append('hr')
					.style('margin','0')
					.style('border','1px solid #909090')

				dVcontent = dropdown.append('div')
					.attr('class','NdDiv');

				dVcontent.append('label')
					.attr('for',d+'velCheckBox')
					.text('Plot Velocity Vectors');

				dVcontent.append('input')
					.attr('id',d+'velCheckBox')
					.attr('value','false')
					.attr('type','checkbox')
					.attr('autocomplete','off')
					.attr('onchange','checkVelBox(this)');

				var selectVType = dVcontent.append('select')
					.attr('class','selectVelType')
					.attr('id',d+'_SelectVelType')
					.on('change',selectVelType)

				var options = selectVType.selectAll('option')
					.data(Object.keys(params.velopts)).enter()
					.append('option')
					.text(function (d) { return d; });

				dheight += 30;
			}

	//this is dynamic, depending on what is in the data
	//create the filters
	//first count the available filters
			showfilts = [];
			for (j=0; j<params.fkeys[d].length; j++){
				var fk = params.fkeys[d][j]
				if (params.parts[d][fk] != null){
					showfilts.push(fk);
				}
			}
			nfilt = showfilts.length;

			if (nfilt > 0){
				dheight += 70;

				dropdown.append('hr')
					.style('margin','0')
					.style('border','1px solid #909090')

				var selectF = dropdown.append('div')
					.attr('style','margin:0px;  padding:5px; height:20px')
					.html('Filters &nbsp')	

					.append('select')
					.attr('class','selectFilter')
					.attr('id',d+'_SelectFilter')
					.on('change',selectFilter)

				var options = selectF.selectAll('option')
					.data(showfilts).enter()
					.append('option')
					.text(function (d) { return d; });


				var filtn = 0;
				for (j=0; j<params.fkeys[d].length; j++){
					var fk = params.fkeys[d][j]
					if (params.parts[d][fk] != null){


						dfilters = dropdown.append('div')
							.attr('id',d+'_FK_'+fk+'_END_Filter')
							.attr('class','FilterClass')

						dfilters.append('div')
							.attr('class','FilterClassLabel')

						dfilters.append('div')
							.attr('id',d+'_FK_'+fk+'_END_FilterSlider')
							.style("margin-top","-1px")

						dfilters.append('input')
							.attr('id',d+'_FK_'+fk+'_END_FilterMinT')
							.attr('class','FilterMinTClass')
							.attr('type','text');

						dfilters.append('input')
							.attr('id',d+'_FK_'+fk+'_END_FilterMaxT')
							.attr('class','FilterMaxTClass')
							.attr('type','text');

						filtn += 1;
					}
					if (filtn > 1){
						d3.selectAll('#'+d+'_FK_'+fk+'_END_Filter')
							.style('display','none');
					}
				}

			} 
			dropdown.style('height',dheight+'px');

		}

/* for color pickers*/
//can I write this in d3? I don't think so.  It needs a jquery object
		$("#"+d+"ColorPicker").spectrum({
		    color: "rgba("+(params.Pcolors[d][0]*255)+","+(params.Pcolors[d][1]*255)+","+(params.Pcolors[d][2]*255)+","+params.Pcolors[d][3]+")",
		    flat: false,
		    showInput: true,
		    showInitial: false,
		    showAlpha: true,
		    showPalette: false,
		    showSelectionPalette: true,
		    clickoutFiresChange: false,
		    maxSelectionSize: 10,
		    preferredFormat: "rgb",
		    change: function(color) {
		        checkColor(this, color);
		    },
		});

		if (params.parts.options.UIcolorPicker[d] != 1){
			$("#"+d+"ColorPicker").spectrum({
			    color: "rgba("+(params.Pcolors[d][0]*255)+","+(params.Pcolors[d][1]*255)+","+(params.Pcolors[d][2]*255)+","+params.Pcolors[d][3]+")",
			    disabled: true,
			});		
		}

	}

// create all the noUISliders
	createPsliders();
	createNsliders();
	createDslider();
	createCFslider();
	createSSslider();
    createFilterSliders();

    updateUICenterText();
    updateUICameraText();
    updateUIRotText();

    params.haveUI = true;

};

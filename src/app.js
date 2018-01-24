var THREE = require('three');
THREE.OrbitControls = require('three-orbit-controls')(THREE);
THREE.GLTFLoader = require('./GLTFLoader.js')(THREE);

// import '../css/style.css';

// var renderer	= new THREE.WebGLRenderer({
//     antialias	: true
// });
// renderer.setClearColor(new THREE.Color('lightgrey'), 1);
// renderer.setSize( window.innerWidth, window.innerHeight );
// document.body.appendChild( renderer.domElement );
// // array of functions for the rendering loop
// var onRenderFcts= [];
// // init scene and camera
// var scene	= new THREE.Scene();
// var camera	= new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 1000);
// camera.position.z = 2;
// var controls	= new THREE.OrbitControls(camera);
// //////////////////////////////////////////////////////////////////////////////////
// //		add an object in the scene
// //////////////////////////////////////////////////////////////////////////////////
// // add a torus	
// var geometry	= new THREE.TorusKnotGeometry(0.5-0.12, 0.12);
// var material	= new THREE.MeshNormalMaterial(); 
// var mesh	= new THREE.Mesh( geometry, material );
// scene.add( mesh );

// //////////////////////////////////////////////////////////////////////////////////
// //		render the whole thing on the page
// //////////////////////////////////////////////////////////////////////////////////
// // handle window resize
// window.addEventListener('resize', function(){
//     renderer.setSize( window.innerWidth, window.innerHeight )
//     camera.aspect	= window.innerWidth / window.innerHeight
//     camera.updateProjectionMatrix()		
// }, false);
// // render the scene
// onRenderFcts.push(function(){
//     renderer.render( scene, camera );		
// });

// // run the rendering loop
// var lastTimeMsec= null;
// requestAnimationFrame(function animate(nowMsec){
//     // keep looping
//     requestAnimationFrame( animate );
//     // measure time
//     lastTimeMsec	= lastTimeMsec || nowMsec-1000/60
//     var deltaMsec	= Math.min(200, nowMsec - lastTimeMsec)
//     lastTimeMsec	= nowMsec
//     // call each update function
//     onRenderFcts.forEach(function(onRenderFct){
//         onRenderFct(deltaMsec/1000, nowMsec/1000)
//     })
// });


var gltf_skeleton = null;



var orbitControls = null;
var container, camera, scene, renderer, loader;
var cameraIndex = 0;
var cameras = [];
var cameraNames = [];
var defaultCamera = null;
var gltf = null;
var mixer = null;
var clock = new THREE.Clock();
function onload() {
    window.addEventListener( 'resize', onWindowResize, false );
    document.addEventListener( 'keydown', function(e) { onKeyDown(e); }, false );
    buildSceneList();
    switchScene(0);
    animate();
}
function initScene(index) {
    container = document.getElementById( 'container' );
    scene = new THREE.Scene();
    scene.background = new THREE.Color( 0x222222 );
    defaultCamera = new THREE.PerspectiveCamera( 45, container.offsetWidth / container.offsetHeight, 0.001, 1000 );
    //defaultCamera.up = new THREE.Vector3( 0, 1, 0 );
    scene.add( defaultCamera );
    camera = defaultCamera;
    var sceneInfo = sceneList[index];
    var spot1 = null;
    if (sceneInfo.addLights) {
        var ambient = new THREE.AmbientLight( 0x222222 );
        scene.add( ambient );
        var directionalLight = new THREE.DirectionalLight( 0xdddddd );
        directionalLight.position.set( 0, 0, 1 ).normalize();
        scene.add( directionalLight );
        spot1   = new THREE.SpotLight( 0xffffff, 1 );
        spot1.position.set( 10, 20, 10 );
        spot1.angle = 0.25;
        spot1.distance = 1024;
        spot1.penumbra = 0.75;
        if ( sceneInfo.shadows ) {
            spot1.castShadow = true;
            spot1.shadow.bias = 0.0001;
            spot1.shadow.mapSize.width = 2048;
            spot1.shadow.mapSize.height = 2048;
        }
        scene.add( spot1 );
    }
    // RENDERER
    renderer = new THREE.WebGLRenderer( { antialias: true } );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    if (sceneInfo.shadows) {
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    container.appendChild( renderer.domElement );
    var ground = null;
    if (sceneInfo.addGround) {
        var groundMaterial = new THREE.MeshPhongMaterial({
                color: 0xFFFFFF
            });
        ground = new THREE.Mesh( new THREE.PlaneBufferGeometry(512, 512), groundMaterial);
        if (sceneInfo.shadows) {
            ground.receiveShadow = true;
        }
        if (sceneInfo.groundPos) {
            ground.position.copy(sceneInfo.groundPos);
        } else {
            ground.position.z = -70;
        }
        ground.rotation.x = -Math.PI / 2;
        scene.add(ground);
    }
    loader = new THREE.GLTFLoader();
    for (var i = 0; i < extensionSelect.children.length; i++) {
        var child = extensionSelect.children[i];
        child.disabled = sceneInfo.extensions.indexOf(child.value) === -1;
        if (child.disabled && child.selected) {
            extensionSelect.value = extension = 'glTF';
        }
    }
    var url = sceneInfo.url;
    var r = eval("/" + '\%s' + "/g");
    url = url.replace(r, extension);
    if (extension === 'glTF-Binary') {
        url = url.replace('.gltf', '.glb');
    }
    var loadStartTime = performance.now();
    var status = document.getElementById("status");
    status.innerHTML = "Loading...";
    loader.load( url, function(data) {
        gltf = data;
        gltf_skeleton = gltf;

        console.log(gltf.gl_avatar);

        var object = gltf.scene;
        status.innerHTML = "Load time: " + ( performance.now() - loadStartTime ).toFixed( 2 ) + " ms.";
        if (sceneInfo.cameraPos)
            defaultCamera.position.copy(sceneInfo.cameraPos);
        if (sceneInfo.center) {
            orbitControls.target.copy(sceneInfo.center);
        }
        if (sceneInfo.objectPosition) {
            object.position.copy(sceneInfo.objectPosition);
            if (spot1) {
                spot1.position.set(sceneInfo.objectPosition.x - 100, sceneInfo.objectPosition.y + 200, sceneInfo.objectPosition.z - 100 );
                spot1.target.position.copy(sceneInfo.objectPosition);
            }
        }
        if (sceneInfo.objectRotation)
            object.rotation.copy(sceneInfo.objectRotation);
        if (sceneInfo.objectScale)
            object.scale.copy(sceneInfo.objectScale);
        if ( sceneInfo.addEnvMap ) {
            var envMap = getEnvMap();
            object.traverse( function( node ) {
                if ( node.material && ( node.material.isMeshStandardMaterial ||
                     ( node.material.isShaderMaterial && node.material.envMap !== undefined ) ) ) {
                    node.material.envMap = envMap;
                    node.material.needsUpdate = true;
                }
            } );
            scene.background = envMap;
        }
        object.traverse( function ( node ) {
            if ( node.isMesh ) node.castShadow = true;
        } );
        cameraIndex = 0;
        cameras = [];
        cameraNames = [];
        if (gltf.cameras && gltf.cameras.length) {
            var i, len = gltf.cameras.length;
            for (i = 0; i < len; i++) {
                var addCamera = true;
                var cameraName = gltf.cameras[i].parent.name || ('camera_' + i);
                if (sceneInfo.cameras && !(cameraName in sceneInfo.cameras)) {
                        addCamera = false;
                }
                if (addCamera) {
                    cameraNames.push(cameraName);
                    cameras.push(gltf.cameras[i]);
                }
            }
            updateCamerasList();
            switchCamera(1);
        } else {
            updateCamerasList();
            switchCamera(0);
        }
        var animations = gltf.animations;
        if ( animations && animations.length ) {
            mixer = new THREE.AnimationMixer( object );
            for ( var i = 0; i < animations.length; i ++ ) {
                var animation = animations[ i ];
                // There's .3333 seconds junk at the tail of the Monster animation that
                // keeps it from looping cleanly. Clip it at 3 seconds
                if ( sceneInfo.animationTime )
                    animation.duration = sceneInfo.animationTime;
                mixer.clipAction( animation ).play();
            }
        }
        scene.add( object );
        onWindowResize();
    }, undefined, function ( error ) {
        console.error( error );
    } );
orbitControls = new THREE.OrbitControls(defaultCamera, renderer.domElement);
}
function onWindowResize() {
    defaultCamera.aspect = container.offsetWidth / container.offsetHeight;
    defaultCamera.updateProjectionMatrix();
    var i, len = cameras.length;
    for (i = 0; i < len; i++) { // just do it for default
        cameras[i].aspect = container.offsetWidth / container.offsetHeight;
        cameras[i].updateProjectionMatrix();
    }
    renderer.setSize( window.innerWidth, window.innerHeight );
}
function animate() {
    requestAnimationFrame( animate );
    if (mixer) mixer.update(clock.getDelta());
    if (cameraIndex == 0)
        orbitControls.update();
    render();
}
function render() {
    renderer.render( scene, camera );
}
function onKeyDown(event) {
    var chr = String.fromCharCode(event.keyCode);
    if (chr == ' ') {
        index = cameraIndex + 1;
        if (index > cameras.length)
        index = 0;
        switchCamera(index);
    } else {
        var index = parseInt(chr);
        if (!isNaN(index)	&& (index <= cameras.length)) {
            switchCamera(index);
        }
    }
}
var envMap;
function getEnvMap() {
    if ( envMap ) {
        return envMap;
    }
    var path = 'textures/cube/Park2/';
    var format = '.jpg';
    var urls = [
        path + 'posx' + format, path + 'negx' + format,
        path + 'posy' + format, path + 'negy' + format,
        path + 'posz' + format, path + 'negz' + format
    ];
    envMap = new THREE.CubeTextureLoader().load( urls );
    envMap.format = THREE.RGBFormat;
    return envMap;
}
var sceneList = [
    {
        name : 'Saber-body-walk', url : './models/gltf/saber-body-walk/saber-body-walk.gltf',
        cameraPos: new THREE.Vector3(3, 2, 3),
        objectRotation: new THREE.Euler(0, 0, 0),
        addLights: true,
        extensions: ['glTF', 'gl_avatar'],
        addEnvMap: true
    },
    {
        name : 'Saber-body-mixamo', url : './models/gltf/saber-body-mixamo-animations/saber-body-animations.gltf',
        cameraPos: new THREE.Vector3(3, 2, 3),
        objectRotation: new THREE.Euler(0, 0, 0),
        addLights: true,
        extensions: ['glTF', 'gl_avatar'],
        addEnvMap: true
    },
    {
        name : 'BoomBox (PBR)', url : './models/gltf/BoomBox/%s/BoomBox.gltf',
        cameraPos: new THREE.Vector3(0.02, 0.01, 0.03),
        objectRotation: new THREE.Euler(0, Math.PI, 0),
        addLights:true,
        extensions: ['glTF', 'glTF-pbrSpecularGlossiness', 'glTF-Binary'],
        addEnvMap: true
    },
    {
        name : 'MetalRoughSpheres (PBR)', url : './models/gltf/MetalRoughSpheres/%s/MetalRoughSpheres.gltf',
        cameraPos: new THREE.Vector3(2, 1, 15),
        objectRotation: new THREE.Euler(0, 0, 0),
        addLights:true,
        extensions: ['glTF', 'glTF-Embedded'],
        addEnvMap: true
    },
    {
        name : 'Duck', url : './models/gltf/Duck/%s/Duck.gltf',
        cameraPos: new THREE.Vector3(0, 3, 5),
        addLights:true,
        addGround:true,
        shadows:true,
        extensions: ['glTF', 'glTF-Embedded', 'glTF-MaterialsCommon', 'glTF-pbrSpecularGlossiness', 'glTF-Binary']
    },
    {
        name : "Monster", url : "./models/gltf/Monster/%s/Monster.gltf",
        cameraPos: new THREE.Vector3(30, 10, 70),
        objectScale: new THREE.Vector3(0.4, 0.4, 0.4),
        objectPosition: new THREE.Vector3(2, 1, 0),
        objectRotation: new THREE.Euler(0, - 3 * Math.PI / 4, 0),
        animationTime: 3,
        addLights:true,
        shadows:true,
        addGround:true,
        // TODO: 'glTF-MaterialsCommon'
        extensions: ['glTF', 'glTF-Embedded', 'glTF-pbrSpecularGlossiness', 'glTF-Binary']
    },
    {
        name : "Cesium Man", url : "./models/gltf/CesiumMan/%s/CesiumMan.gltf",
         cameraPos: new THREE.Vector3(0, 3, 10),
         objectRotation: new THREE.Euler(0, 0, 0),
         addLights:true,
         addGround:true,
         shadows:true,
        // TODO: 'glTF-MaterialsCommon'
        extensions: ['glTF', 'glTF-Embedded', 'glTF-pbrSpecularGlossiness', 'glTF-Binary']
    },
    {
        name : "Cesium Milk Truck",
        url : "./models/gltf/CesiumMilkTruck/%s/CesiumMilkTruck.gltf",
        cameraPos: new THREE.Vector3(0, 3, 10),
        addLights:true,
        addGround:true,
        shadows:true,
        // TODO: 'glTF-MaterialsCommon'
        extensions: ['glTF', 'glTF-Embedded', 'glTF-pbrSpecularGlossiness', 'glTF-Binary']
    },
    {
        name : "Rigged Simple",
        url : "./models/gltf/RiggedSimple/%s/RiggedSimple.gltf",
        cameraPos: new THREE.Vector3(0, 5, 15),
        objectRotation: new THREE.Euler(0, 90, 0),
        addLights:true,
        shadows:true,
        // TODO: 'glTF-MaterialsCommon'
        extensions: ['glTF', 'glTF-Embedded', 'glTF-pbrSpecularGlossiness', 'glTF-Binary']
    },
    {
        name : 'Outlined Box',
        url : './models/gltf/OutlinedBox/OutlinedBox.gltf',
        cameraPos: new THREE.Vector3(0, 5, 15),
        objectScale: new THREE.Vector3(0.01, 0.01, 0.01),
        objectRotation: new THREE.Euler(0, 90, 0),
        addLights:true,
        shadows:true,
        extensions: ['glTF']
    },
];
function buildSceneList() {
    var elt = document.getElementById('scenes_list');
    while( elt.hasChildNodes() ){
        elt.removeChild(elt.lastChild);
    }
    var i, len = sceneList.length;
    for (i = 0; i < len; i++) {
        var option = document.createElement("option");
        option.text=sceneList[i].name;
        elt.add(option);
    }
}
function switchScene(index) {
    cleanup();
    initScene(index);
    var elt = document.getElementById('scenes_list');
    elt.selectedIndex = index;
}
function selectScene() {
    var select = document.getElementById("scenes_list");
    var index = select.selectedIndex;
    if (index >= 0) {
        switchScene(index);
    }
}
function switchCamera(index) {
    cameraIndex = index;
    if (cameraIndex == 0) {
        camera = defaultCamera;
    }
    if (cameraIndex >= 1 && cameraIndex <= cameras.length) {
        camera = cameras[cameraIndex - 1];
    }
    var elt = document.getElementById('cameras_list');
    elt.selectedIndex = cameraIndex;
}
function updateCamerasList() {
    var elt = document.getElementById('cameras_list');
    while( elt.hasChildNodes() ){
        elt.removeChild(elt.lastChild);
    }
    var option = document.createElement("option");
    option.text="[default]";
    elt.add(option);
    var i, len = cameraNames.length;
    for (i = 0; i < len; i++) {
        var option = document.createElement("option");
        option.text=cameraNames[i];
        elt.add(option);
    }
}
function selectCamera() {
    var select = document.getElementById("cameras_list");
    var index = select.selectedIndex;
    if (index >= 0) {
        switchCamera(index);
    }
}
function toggleAnimations() {
    var i, len = gltf.animations.length;
    for (i = 0; i < len; i++) {
        var clip = gltf.animations[i];
        var action = mixer.existingAction( clip );
        if (action.isRunning()) {
            action.stop();
        } else {
            action.play();
        }
    }
}
var extensionSelect = document.getElementById("extensions_list");
var extension = extensionSelect.value;
function selectExtension()
{
    extension = extensionSelect.value;
    selectScene();
}
function cleanup() {
    if (container && renderer) {
        container.removeChild(renderer.domElement);
    }
    cameraIndex = 0;
    cameras = [];
    cameraNames = [];
    defaultCamera = null;
    if (!loader || !mixer)
        return;
    mixer.stopAllAction();
}

document.getElementById('scenes_list').onchange = selectScene;
document.getElementById('scenes_list').ondblclick = selectScene;

document.getElementById('cameras_list').onchange = selectCamera;
document.getElementById('cameras_list').ondblclick = selectCamera;

document.getElementById('extensions_list').onchange = selectExtension;

document.getElementById('animation_toggle').onclick = toggleAnimations;

onload();


document.getElementById('maid_clothes_btn').onclick = function() {
    // test
    // load maid dress
    loader.setGlAvatarOfLinkingSkeleton(gltf_skeleton.gl_avatar);
    loader.load( 'models/gltf/saber-maid-dress/saber-maid-dress.gltf', function(data) {
        gltf = data;
        var object = gltf.scene;
        // status.innerHTML = "Load time: " + ( performance.now() - loadStartTime ).toFixed( 2 ) + " ms.";

        // temp
        console.log(gltf_skeleton);


        object.traverse( function ( node ) {
            if ( node.isMesh ) node.castShadow = true;
        } );


        // console.log(gltf.extensions.gl_avatar);
        // console.log(gltf.gl_avatar_skeleton);
        // create skinned mesh and .bind(skeleotn)

        scene.add( object );
        onWindowResize();
    }, undefined, function ( error ) {
        console.error( error );
    } );
};

document.getElementById('maid_hair_btn').onclick = function() {
    // test
    // load maid dress
    loader.setGlAvatarOfLinkingSkeleton(gltf_skeleton.gl_avatar);
    loader.load( 'models/gltf/saber-maid-hair/saber-maid-hair.gltf', function(data) {
        gltf = data;
        var object = gltf.scene;
        // status.innerHTML = "Load time: " + ( performance.now() - loadStartTime ).toFixed( 2 ) + " ms.";

        // temp
        console.log(gltf_skeleton);


        object.traverse( function ( node ) {
            if ( node.isMesh ) node.castShadow = true;
        } );


        // console.log(gltf.extensions.gl_avatar);
        // console.log(gltf.gl_avatar_skeleton);
        // create skinned mesh and .bind(skeleotn)

        scene.add( object );
        onWindowResize();
    }, undefined, function ( error ) {
        console.error( error );
    } );
};


// function createBones ( object, jsonBones ) {
// 	/* adapted from the THREE.SkinnedMesh constructor */
// 	// create bone instances from json bone data
//   const bones = jsonBones.map( gbone => {
// 		bone = new THREE.Bone()
// 		bone.name = gbone.name
// 		bone.position.fromArray( gbone.pos )
// 		bone.quaternion.fromArray( gbone.rotq )
// 		if ( gbone.scl !== undefined ) bone.scale.fromArray( gbone.scl )
// 		return bone
//   } )
//   // add bone instances to the root object
// 	jsonBones.forEach( ( gbone, index ) => {
//       if ( gbone.parent !== -1 && gbone.parent !== null && bones[ gbone.parent ] !== undefined ) {
//         bones[ gbone.parent ].add( bones[ index ] )
//       } else {
//         object.add( bones[ index ] )
//       }
//   } )
// 	return bones
// }
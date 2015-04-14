var scene;
var camera;
var renderer;
var controls;

var TOP = ['Top_Head', 'FR_Head', 'BR_Head', 'FL_Head', 'BL_Head', 'R_Shoulder_Top', 'R_Shoulder_Back', 'R_Bicep', 'R_Elbow', 'R_Wrist_Upper', 'R_Wrist_Lower', 'R_Pinky', 'R_Thumb', 'L_Shoulder_Top', 'L_Shoulder_Back', 'L_Bicep', 'L_Elbow', 'L_Wrist_Upper', 'L_Wrist_Lower', 'L_Pinky', 'L_Thumb', 'Topspine', 'Sternum', 'Midback', 'Lowback_Center', 'Lowback_Right', 'Lowback_Left', 'Root']
var BOTTOM = ['BRHip', 'BLHip', 'FRHip', 'FLHip', 'R_Troc', 'R_Thigh', 'R_Knee', 'R_Calf', 'R_Ankle', 'R_Foot_Lat', 'R_Toe_Lat', 'R_Toe_Med', 'L_Troc', 'L_Thigh', 'L_Knee', 'L_Calf', 'L_Ankle', 'L_Foot_Lat', 'L_Toe_Lat', 'L_Toe_Med'];

var SCALE = 0.05;
var trc = {};
var isPlaying = true;
var currentFrame = 0;
var startTime;
var previousTime;
var interval;
var dynObjs = [];
var mkrParams;
var gui;
var trailLength = 50;

var gridHelper;
var isGridHelperVisible = true;
var isPtcVisible = true;
var isLoading = false;

function load_data_index(url, callback) {
    $.getJSON(url, function(data) {

        for (var folder in data) {
            var innerHeader = $(document.createElement('div'))
                .attr({id: folder, role: 'tab'})
                .addClass('panel-heading').append(
                $(document.createElement('h4'))
                    .addClass('panel-title').append(
                    $(document.createElement('a'))
                        .attr({ "data-toggle":"collapse",
                            "data-parent":"#accordion",
                            href:"#collapse"+folder,
                            "aria-expanded":true,
                            "aria-controls":"collapse"+folder
                        })
                        .html(folder)
                    )
                )

            var body = $(document.createElement('div'))
                .addClass("panel-body");

            for (var i=0; i<data[folder].length; i++) {
                var name = data[folder][i].name;
                var url = data[folder][i].url;
                var btn = $(document.createElement('button'))
                    .attr({ type:"button",
                            onclick:"open_trc('"+url+"')"})
                    .html(name);
                body.append(btn);
            }

            var bodyWrapper = $(document.createElement('div'))
                .attr({ id:"collapse"+folder,
                        role:"tabpanel",
                        "aria-labelledby":"heading"+folder
                })
                .addClass("panel-collapse")
                .addClass("collapse")
                .append(body)

            $("#trc-accordion").append(
                $(document.createElement('div'))
                .addClass("panel")
                .addClass("panel-default")
                .append(innerHeader))
                .append(bodyWrapper);

        }
        init();
    });
}

function init() {

    renderer = new THREE.WebGLRenderer();
    renderer.setClearColor( 0x212538 );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    camera = new THREE.PerspectiveCamera(70, window.innerWidth/window.innerHeight, 0.1, 1000);
    window.addEventListener('resize', function() {
        var WIDTH = window.innerWidth, HEIGHT = window.innerHeight;
        renderer.setSize(WIDTH, HEIGHT);
        camera.aspect = WIDTH/HEIGHT;
        camera.updateProjectionMatrix();
    });
    camera.position.z = 120;

    $('#shortcutModal').modal({
        keyboard: true,
        show: false
    })
    $('#loadModal').modal({
        keyboard: false
    })
}

function new_scene() {
    if (scene != undefined) {
        scene = {};
    }
    scene = new THREE.Scene();
    var ambient = new THREE.AmbientLight( 0x101030 );
    scene.add( ambient );

    var directionalLight = new THREE.DirectionalLight( 0xffeedd );
    directionalLight.position.set( 0, 0, 0.5 );
    scene.add( directionalLight );

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.damping = 0.2;

    gridHelper = new THREE.GridHelper(100, 10);
    scene.add(gridHelper);

    currentFrame = 0;
    dynObjs = [];
    mkrParams = [];
    isGridHelperVisible = true;
    isPtcVisible = true;
}

function initGui() {
    if (gui != undefined) {
        gui = {};
        $(".dg.ac").html('');
    }

    gui = new dat.GUI({autoPlace: true});

    mkrParams = {
        all:selectAll,
        none:selectNone,
        toggle:toggleSelection
    };
    for (var i=0; i<trc.data.groups.length; i++) {
        mkrParams[trc.data.groups[i]] = false;
    }
    gui.add(mkrParams, "all");
    gui.add(mkrParams, "none");
    gui.add(mkrParams, "toggle");

    for (var i=0; i<trc.data.groups.length; i++) {
        gui.add(mkrParams, trc.data.groups[i]).listen();
    }
    isLoading = false;
    animate();
}

function selectAll() {
    for (var i=0; i<trc.data.groups.length; i++ ) {
        mkrParams[trc.data.groups[i]] = true;
    }
}

function selectNone() {
    for (var i=0; i<trc.data.groups.length; i++ ) {
        mkrParams[trc.data.groups[i]] = false;
    }
}

function toggleSelection() {
    for (var i=0; i<trc.data.groups.length; i++ ) {
        mkrParams[trc.data.groups[i]] = !mkrParams[trc.data.groups[i]];
    }
}

function load_trc(url, callback) {
    console.log("Reading ", url);
    $("#loadingText").html(url);
    $("#loadingModal").modal({
        keyboard: false,
        show: true
    })
    if (trc!=undefined) {
        trc = {};
    }
    $.getJSON(url, function(trcData) {
        trcData.vertSamples = []
        for (var i=0; i<trcData.samples.length; i++) {
            var sample = trcData.samples[i].samples;
            var vertices = []
            for (var j=0; j<sample.length; j=j+3) {
                var vert = new THREE.Vector3(
                    sample[j]   * SCALE,
                    sample[j+1] * SCALE,
                    sample[j+2] * SCALE);
                vertices.push(vert);
            }
            trcData.vertSamples.push(vertices);
        }
        trc.data = trcData;
        var geometry = new THREE.Geometry();
        geometry.vertices = trc.data.vertSamples[currentFrame];
        var material = new THREE.PointCloudMaterial({size: 1});
        trc.ptc = new THREE.PointCloud( geometry, material );
        scene.add(trc.ptc);

        interval = (1000.0 / trc.data.DataRate);
        startTime = Date.now();
        previousTime = Date.now();
        $('#loadingModal').modal('hide');
        callback();
    });
}

function open_trc(url) {
    isLoading = true;
    // clean scene
    $('#loadModal').modal('hide');
    new_scene();
    load_trc(url, initGui);
}

function animate() {
    if (isLoading) return;
    var currentTime=Date.now();
    if (isPlaying) {
        var frameNumber = Math.floor(((currentTime - startTime)/interval) % trc.data.NumFrames);
        if (currentFrame != frameNumber) {
            currentFrame = frameNumber;
            trc.ptc.geometry.vertices = trc.data.vertSamples[currentFrame];
            trc.ptc.geometry.verticesNeedUpdate = true;
            //
            for (var i=0; i<dynObjs.length; i++) {
                dynObjs[i].updateFunc(dynObjs[i]);
            }
        }

    } else {
        trc.ptc.geometry.vertices = trc.data.vertSamples[currentFrame];
        trc.ptc.geometry.verticesNeedUpdate = true;
        for (var i=0; i<dynObjs.length; i++) {
            dynObjs[i].updateFunc(dynObjs[i]);
        }
    }
    requestAnimationFrame(animate);
    render();
}

function render() {
    renderer.render(scene, camera);
    controls.update();
}

var keyPressed = function(event) {
    console.log(event);
    switch (event.keyCode) {
        case 32: // space - stop and start playback
            isPlaying = !isPlaying;
            break;
        case 65: // a - creates a curve that spans through the selected points over the duration of the clip
            create_mkr_path();
            break;
        case 66: // b - creates brush strokes along the ground, following the selected markers
            create_speed_circles();
            break;
        case 67: // c - creates a spline curve between the selected markers that travels with them
            create_mkr_curve();
            break;
        case 71: // g - toggles the grid visibility
            if (isGridHelperVisible) {
                scene.remove(gridHelper)
            } else {
                scene.add(gridHelper);
            }
            isGridHelperVisible = !isGridHelperVisible;
            break;
        case 75: // k - show keyboard shortcuts
            $('#shortcutModal').modal('show');
            break;
        case 77: // m - toggles the marker visibility
            if (isPtcVisible) {
                scene.remove(trc.ptc)
            } else {
                scene.add(trc.ptc);
            }
            isPtcVisible = !isPtcVisible;
            break;
        case 79: // o - open load dialog
            $('#loadModal').modal('show');
            break;
        case 83: // s - toggle selection menu visibility
            if (gui.closed) { gui.open(); } else { gui.close(); }
            break;
        case 84: // t - create motion trails
            create_speed_spheres();
            break;
        case 85: // u - create "up" arrows
            create_vertical_arrows();
            break;
        case 86: // v - create velocity vector arrows
            create_velocity_arrows();
            break;
        case 88: // x - step one frame forward in time
            if (!isPlaying) {
                currentFrame += 1;
            }
            break;
        case 90: // z - step one frame back in time
            if (!isPlaying) {
                currentFrame -= 1;
            }
            break;
        case 192: // ` - remove all lines
            // `
            for(var i=scene.children.length-1; i>=0; i--) {
                if (scene.children[i].type === "Line" || scene.children[i].type === "ArrowHelper") {
                    scene.remove(scene.children[i]);
                }
            }
            break;
    }
}
document.addEventListener("keydown", keyPressed, false);

function get_selected_marker_indices() {
    var indices = [];
    for (var i=0; i<trc.data.groups.length; i++) {
        var name = trc.data.groups[i];
        if ( mkrParams[name]) {
            var mkrIndex = trc.data.groups.indexOf(name);
            indices.push(mkrIndex);
        }
    }
    return indices;
}

function create_mkr_path() {
    var indices = get_selected_marker_indices();
    console.log(indices);
    for (var i=0; i<indices.length; ++i){
        var mkrIndex = indices[i];
        var mkrName = trc.data.groups[mkrIndex];
        var points = [];
        for (var j=0; j<trc.data.vertSamples.length; j++) {
            points.push(trc.data.vertSamples[j][mkrIndex]);
        }
        var geometry = new THREE.Geometry();
        var curve = new THREE.SplineCurve3( points );
        geometry.vertices = curve.getPoints( points.length );
        var color;
        if (mkrName.lastIndexOf("L_") === 0) {
            color = 0xE0E7AB;
        } else if (mkrName.lastIndexOf("R_") === 0) {
            color = 0xA2CFA5;
        } else {
            color = 0xF5974E;
        }
        var material = new THREE.LineBasicMaterial( { color : color } );
        var splineObject = new THREE.Line( geometry, material );
        scene.add(splineObject);
    }
}

function create_mkr_curve() {

    var indices = get_selected_marker_indices();
    var points = [];
    var follow = true;

    for (var i=0; i<indices.length; i++) {
        var mkrIndex = indices[i];
        points.push(trc.data.vertSamples[currentFrame][mkrIndex]);
    }
    var geometry = new THREE.Geometry();
    var curve = new THREE.SplineCurve3( points );
    geometry.vertices = curve.getPoints( indices.length*10 );
    var material = new THREE.LineBasicMaterial( { color : 0xffffff } );
    var splineObject = new THREE.Line( geometry, material );
    scene.add(splineObject);
    if (follow) {
        dynObjs.push({
            obj: splineObject,
            indices: indices,
            resolution: indices.length*20,
            isFollowing: follow,
            updateFunc: update_curve
        });
    }
}

function update_curve(splineObject) {
    if (!(splineObject.isFollowing)) {
        return;
    }
    var points = [];
    for (var i=0; i<splineObject.indices.length; i++) {
        points.push(trc.data.vertSamples[currentFrame][splineObject.indices[i]]);
    }
    var curve = new THREE.SplineCurve3( points );
    splineObject.obj.geometry.vertices = curve.getPoints( splineObject.resolution );
    splineObject.obj.geometry.verticesNeedUpdate = true;
}

function create_vertical_arrows() {
    var indices = get_selected_marker_indices();
    for (var i=0; i<indices.length; i++) {

        var origin = new THREE.Vector3( 0, 0, 0 );
        origin.copy(trc.data.vertSamples[currentFrame][indices[i]]);

        var mkrName = trc.data.groups[indices[i]];
        var dir, hex, length, up;
        if (TOP.indexOf(mkrName) != -1) {
            dir = new THREE.Vector3( 0, 1, 0 );
            hex = 0xD24344;
            length = 100-origin.y;
            up = true;
        } else {
            dir = new THREE.Vector3( 0, -1, 0 );
            hex = 0xA2CFA5;
            length = 10; //origin.y;
            up = false;
        }

        var arrowHelper = new THREE.ArrowHelper( dir, origin, length, hex );
        scene.add( arrowHelper );
        dynObjs.push({
            obj: arrowHelper,
            index: indices[i],
            updateFunc: update_vertical_arrow,
            up: up
        });
    }
}

function update_vertical_arrow(arrowObj) {
    arrowObj.obj.position.copy(trc.data.vertSamples[currentFrame][arrowObj.index]);
    if (arrowObj.up) {
        arrowObj.obj.setLength(100-arrowObj.obj.position.y, 1,10);
    } else {
        arrowObj.obj.setLength(arrowObj.obj.position.y, 1,10);
    }

}

function create_velocity_arrows() {
    var indices = get_selected_marker_indices();
    for (var i=0; i<indices.length; i++) {

        var velocity = calc_velocity(indices[i], 30);
        var length = velocity.length();
        var dir = velocity.normalize();
        var origin = new THREE.Vector3( 0, 0, 0 );
        origin.copy(trc.data.vertSamples[currentFrame][indices[i]]);

        var hex = 0xE96B56;

        var arrowHelper = new THREE.ArrowHelper( dir, origin, length, hex );
        scene.add( arrowHelper );
        dynObjs.push({
            obj: arrowHelper,
            index: indices[i],
            updateFunc: update_velocity_arrow
        });
    }
}

function update_velocity_arrow(arrowObj) {
    var velocity = calc_velocity(arrowObj.index, 10);
    arrowObj.obj.setLength(velocity.length()*0.3, velocity.length()*0.2, velocity.length()*0.1);
    var v = velocity.length();
    arrowObj.obj.setDirection(velocity.normalize());
    arrowObj.obj.position.copy(trc.data.vertSamples[currentFrame][arrowObj.index]);

    var col = new THREE.Color();
    col.setHex(0xE96B56);
    col.offsetHSL(0.0,0.0,v*0.0005);

    arrowObj.obj.setColor(col.getHex());
}

var maxSpeeds = {}
function create_speed_circles() {
    var indices = get_selected_marker_indices();
    for (var i=0; i<indices.length; i++) {
        var index = indices[i];
        var maxSpeed = calc_max_speed(index)
        maxSpeeds[index] = maxSpeed;
        dynObjs.push({
            obj: null,
            index: index,
            updateFunc: update_speed_circles,
            maxSpeed: maxSpeed,
            children: []
        });
    }
}

function update_speed_circles(obj) {
    if (currentFrame === 0) { return; }

    var speed = calc_speed(obj.index) / obj.maxSpeed;
    var radius = 1.0;
    var circle;
    var scaleFactor = speed*8;

    if (obj.children.length > trailLength ) {
        circle = obj.children.shift();
        circle.material.opacity = 1.0;
    } else {
        var segments = 8;
        var circleGeometry = new THREE.CircleGeometry( radius, segments );
        var material = new THREE.MeshBasicMaterial({
            color: 0xA2CFA5,
            transparent: true
        });
        circle = new THREE.Mesh( circleGeometry, material );
        console.log("New circle");
        circle.matrixAutoUpdate = false;
        circle.rotateOnAxis (new THREE.Vector3( 1, 0, 0 ), degToRad(-90.0));
        scene.add( circle );
    }
    circle.position.copy(trc.data.vertSamples[currentFrame][obj.index]);
    circle.position.setY(0.0);
    circle.scale.copy(new THREE.Vector3(scaleFactor, scaleFactor, 1.0 ));
    circle.updateMatrix();
    for (var i=0; i<obj.children.length; i++) {
        obj.children[i].material.opacity *= 0.95;
    }
    obj.children.push(circle);
}

function create_speed_spheres() {
    var indices = get_selected_marker_indices();
    for (var i=0; i<indices.length; i++) {
        var index = indices[i];
        var maxSpeed = calc_max_speed(index)
        maxSpeeds[index] = maxSpeed;
        dynObjs.push({
            obj: null,
            index: index,
            updateFunc: update_speed_spheres,
            maxSpeed: maxSpeed,
            children: []
        });
    }
}

function update_speed_spheres(obj) {
    if (currentFrame === 0) { return; }
    var speed = calc_speed(obj.index) / obj.maxSpeed;
    var radius = speed*5;
    var segments = 6;
    var sphere;

    if (obj.children.length > trailLength ) {
        sphere = obj.children.shift();
        sphere.material.opacity = 1.0;
    } else {
        var geometry = new THREE.SphereGeometry(1.0, segments, segments);
        var material = new THREE.MeshBasicMaterial({
            color: 0xD24344,
            transparent: true
        });
        sphere = new THREE.Mesh(geometry, material);
        scene.add(sphere);
    }
    sphere.position.copy(trc.data.vertSamples[currentFrame][obj.index]);
    sphere.scale.copy(new THREE.Vector3(radius, radius, radius ));
    sphere.updateMatrix();
    for (var i=0; i<obj.children.length; i++) {
        obj.children[i].material.opacity *= 0.95;
    }
    obj.children.push(sphere);
}

function calc_velocity(index, tDelta) {
    // tDelta in samples | 120 = 1 second
    var points = []
    for (var i=0; i<tDelta; i++) {
        if (currentFrame+i < trc.data.NumFrames) {
            points.push(trc.data.vertSamples[currentFrame+i][index]);
        }
    }
    var curve = new THREE.SplineCurve3( points );
    var length = curve.getLength();

    var speed = length/ (tDelta / trc.data.DataRate);

    // get normalized vector
    var velocity =  new THREE.Vector3();
    velocity.subVectors(curve.getPoint(1),curve.getPoint(0));
    velocity.normalize();

    velocity.multiplyScalar(speed);

    return velocity;
}

function calc_speed(index) {
    if (currentFrame===0) {
        return 0;
    }
    var t1 = trc.data.vertSamples[currentFrame-1][index];
    var t2 = trc.data.vertSamples[currentFrame][index];
    var len = new THREE.Vector3()
    len.subVectors(t2, t1);
    return len.length();
}

function calc_max_speed(index) {
    var maxLength = 0.0;
    for (var i=1; i<trc.data.NumFrames; i++) {
        var t1 = trc.data.vertSamples[i-1][index];
        var t2 = trc.data.vertSamples[i][index];
        var len = new THREE.Vector3()
        len.subVectors(t2, t1);
        if (len.length() > maxLength) {
            maxLength = len.length();
        }
    }
    return maxLength;
}

var degToRad = function(val) {
    return val*Math.PI/180.0;
}

load_data_index("data/trc.json", init);
//init();
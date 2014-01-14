/// <reference path="http://ajax.googleapis.com/ajax/libs/jquery/1/jquery.min.js" />
/// <reference path="three.min.js" />
/// <reference path="js/controls/OrbitControls.js" />
/// <reference path="js/Detector.js" />
/// <reference path="mesh.js" />
/// <reference path="fem.js" />
/// <reference path="https://rawgithub.com/mrdoob/three.js/master/build/three.js" />

$(document).ready(function () {

	// ブラウザのWebGL対応を調べる
	if(!Detector.webgl) Detector.addGetWebGLMessage();
	// IE使用者に警告を出す
	var ua = window.navigator.userAgent.toLowerCase();
	window.isMSIE = ua.indexOf("trident") >= 0;
	if(window.isMSIE)
		alert("できればIE以外のブラウザで見てください");

	// レンダラの初期化
	var renderer=new THREE.WebGLRenderer({ antialias: true });
	renderer.setSize(0.95*window.innerWidth, 0.95*window.innerHeight);
	renderer.setClearColor(0x000000, 1);
	document.body.appendChild(renderer.domElement);
	renderer.shadowMapEnabled=true;

	// シーンの作成
	var scene=new THREE.Scene();

	// カメラの作成
	var camera=new THREE.PerspectiveCamera(15, window.innerWidth/window.innerHeight, 1, 100000);
	camera.position=new THREE.Vector3(0, 0, 5000);
	camera.lookAt(new THREE.Vector3(0, 0, 0));
	scene.add(camera);

	// カメラコントロールを作成
	var cameraCtrl=new THREE.OrbitControls(camera);
	cameraCtrl.center=new THREE.Vector3(0, 0, 0);

	// ライトの作成
	var light=new THREE.SpotLight(0xffffff, 1.0, 0, Math.PI/10, 40);
	light.position.set(500, -500, 2000);
	light.castShadow=true;
	lightHelper=new THREE.SpotLightHelper(light, 100);
	light.shadowCameraVisible=false;
	light.shadowMapWidth = 2048;
	light.shadowMapHeight = 2048;
	scene.add(light);
	//scene.add(lightHelper);


	var brain = new THREE.Geometry();
	var mesh = new RectangleMesh(100, 400, 2, 8);
	var fem = new FEM(mesh.Pos, mesh.Tri);
	var thickness = 50;
	// 上面の頂点
	for(var i = 0; i < fem.posNum; i++)
		brain.vertices.push(new THREE.Vector3(fem.pos[i][0], fem.pos[i][1], thickness * 0.5));
	// 下面の頂点
	for(var i = 0; i < fem.posNum; i++)
		brain.vertices.push(new THREE.Vector3(fem.pos[i][0], fem.pos[i][1], -thickness * 0.5));

	// 面
	for(var i = 0; i < fem.triNum; i++){
		brain.faces.push(new THREE.Face3(fem.tri[i][0], fem.tri[i][1], fem.tri[i][2]));
		brain.faces.push(new THREE.Face3(fem.tri[i][0] + fem.posNum, fem.tri[i][2] + fem.posNum, fem.tri[i][1] + fem.posNum));
		// 側面
		brain.faces.push(new THREE.Face3(fem.tri[i][1], fem.tri[i][0], fem.tri[i][0] + fem.posNum));
		brain.faces.push(new THREE.Face3(fem.tri[i][1], fem.tri[i][0] + fem.posNum, fem.tri[i][1] + fem.posNum));
		brain.faces.push(new THREE.Face3(fem.tri[i][2], fem.tri[i][1], fem.tri[i][1] + fem.posNum));
		brain.faces.push(new THREE.Face3(fem.tri[i][2], fem.tri[i][1] + fem.posNum, fem.tri[i][2] + fem.posNum));
		brain.faces.push(new THREE.Face3(fem.tri[i][0], fem.tri[i][2], fem.tri[i][2] + fem.posNum));
		brain.faces.push(new THREE.Face3(fem.tri[i][0], fem.tri[i][2] + fem.posNum, fem.tri[i][0] + fem.posNum));
	}


	var brainMaterial = new THREE.MeshPhongMaterial({
		color: 0xeb7988, specular: 0xffffff, shininess: 50,
		side: THREE.DoubleSide
	});
	// 法線ベクトル
	brain.computeFaceNormals();
	brain.computeVertexNormals();
	// メッシュオブジェクト作成
	var brainMesh = new THREE.Mesh(brain, brainMaterial);
	brainMesh.position.set(0, 0, 100);
	brainMesh.castShadow = true;

	// torusオブジェクトの作成
	var torus=new THREE.Mesh(
		new THREE.TorusGeometry(80, 40, 50, 50),
		new THREE.MeshPhongMaterial({color: 0x00ff00, specular: 0xffffff, shininess: 50,side: THREE.DoubleSide})
	);
	torus.castShadow=true;
	torus.position.set(300, 350, 100);

	// 床オブジェクトの作成
	var plane=new THREE.Mesh(
			new THREE.CubeGeometry(2000, 2000, 10, 100, 100), 
			new THREE.MeshLambertMaterial({ color: 0xcccccc }) 
	);
	plane.receiveShadow=true;
	plane.position.set(0, 0, 0);


	// メッシュをsceneへ追加
	scene.add(brainMesh);
	scene.add(torus);
	scene.add(plane);

	// FEMの境界条件
	fem.gripRad = 30;
	fem.selectHoldNodes([[0,-30]]);

	// レンダリング
	var baseTime=+new Date;
	var time;
	var step=0;
	function render() {
		time=(+new Date-baseTime)/1000.0;
		requestAnimationFrame(render);

		fem.setBoundary("Down", [[200*Math.sin(step*0.05),-30]], false);
		fem.calcDynamicDeformation(0.1);
		for(var i = 0; i < fem.posNum; i++) {
			brain.vertices[i].x = fem.pos[i][0];
			brain.vertices[i].y = fem.pos[i][1];
			brain.vertices[i].z = 0.5*thickness;
		}
		for(var i = 0; i < fem.posNum; i++) {
			brain.vertices[i+fem.posNum].x = fem.pos[i][0];
			brain.vertices[i+fem.posNum].y = fem.pos[i][1];
			brain.vertices[i+fem.posNum].z = -0.5*thickness;
		}
		brain.computeFaceNormals();
		brain.computeVertexNormals();
		brain.verticesNeedUpdate = true;
		brain.normalsNeedUpdate = true;

		cameraCtrl.update();

		renderer.render(scene, camera);
		++step;
	};

	// リサイズに応じてレンダリング領域のサイズを変える
	window.addEventListener('resize', function () {
		renderer.setSize(0.95*window.innerWidth, 0.95*window.innerHeight);
		camera.aspect=window.innerWidth/window.innerHeight;
		camera.updateProjectionMatrix();
	}, false);

	render();
});
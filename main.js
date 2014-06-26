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
	var renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.setClearColor(0x000000, 1);
	document.body.appendChild(renderer.domElement);
	renderer.shadowMapEnabled = true;

	// シーンの作成
	var scene = new THREE.Scene();

	// カメラの作成
	var camera = new THREE.PerspectiveCamera(15, window.innerWidth / window.innerHeight, 1, 100000);
	camera.position = new THREE.Vector3(0, 0, 5000);
	camera.lookAt(new THREE.Vector3(0, 0, 0));
	scene.add(camera);

	// カメラコントロールを作成
	var cameraCtrl = new THREE.OrbitControls(camera);
	cameraCtrl.center = new THREE.Vector3(0, 0, 0);

	// ライトの作成
	var light = new THREE.SpotLight(0xffffff, 1.0, 0, Math.PI / 5, 30);
	light.position.set(250, -250, 1000);
	light.castShadow = true;
	lightHelper = new THREE.SpotLightHelper(light, 100);
	light.shadowCameraVisible = false;
	light.shadowMapWidth = 2048;
	light.shadowMapHeight = 2048;
	scene.add(light);
	//scene.add(lightHelper);


	var niku = new THREE.Geometry();
	var mesh = new RectangleMesh(200, 200, 5, 5);
	var fem = new FEM(mesh.Pos, mesh.Tri);
	var thickness = 50;
	// 上面の頂点
	for(var i = 0; i < fem.posNum; i++)
		niku.vertices.push(new THREE.Vector3(fem.pos[i][0], fem.pos[i][1], thickness * 0.5));
	// 下面の頂点
	for(var i = 0; i < fem.posNum; i++)
		niku.vertices.push(new THREE.Vector3(fem.pos[i][0], fem.pos[i][1], -thickness * 0.5));
	// 面
	var ed = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
	for(var i = 0; i < fem.triNum; i++) {
		niku.faces.push(new THREE.Face3(fem.tri[i][0], fem.tri[i][1], fem.tri[i][2]));
		niku.faces.push(new THREE.Face3(fem.tri[i][0] + fem.posNum, fem.tri[i][2] + fem.posNum, fem.tri[i][1] + fem.posNum));
		// 側面 長方形メッシュであることを仮定し、左右上下の端に位置する頂点を用いてポリゴンを作成
		for(var j=0; j<3; j++){
			ed[0].x = fem.pos[fem.tri[i][(j+1)%3]][0];
			ed[0].y = fem.pos[fem.tri[i][(j+1)%3]][1];
			ed[1].x = fem.pos[fem.tri[i][j]][0];
			ed[1].y = fem.pos[fem.tri[i][j]][1];
			if(
				(ed[0].x == mesh.minx || ed[0].x == mesh.maxx || ed[0].y == mesh.miny || ed[0].y == mesh.maxy)
				&&
				(ed[1].x == mesh.minx || ed[1].x == mesh.maxx || ed[1].y == mesh.miny || ed[1].y == mesh.maxy)
			){
				niku.faces.push(new THREE.Face3(fem.tri[i][(j + 1) % 3], fem.tri[i][j],              fem.tri[i][j] + fem.posNum));
				niku.faces.push(new THREE.Face3(fem.tri[i][(j + 1) % 3], fem.tri[i][j] + fem.posNum, fem.tri[i][(j + 1) % 3] + fem.posNum));
			}
		}
	}


	var nikuMaterial = new THREE.MeshPhongMaterial({
		color: 0xeb7988, specular: 0xffffff, shininess: 50,
		side: THREE.DoubleSide
	});
	// 法線ベクトル
	niku.computeFaceNormals();
	niku.computeVertexNormals();
	// メッシュオブジェクト作成
	var nikuMesh = new THREE.Mesh(niku, nikuMaterial);
	nikuMesh.position.set(0, 0, 0.5 * thickness);
	//nikuMesh.castShadow = true;
	nikuMesh.receiveShadow = true;

	// 床オブジェクトの作成
	var plane = new THREE.Mesh(
			new THREE.CubeGeometry(2000, 2000, 10, 100, 100),
			new THREE.MeshLambertMaterial({ color: 0xcccccc })
	);
	plane.receiveShadow = true;
	plane.position.set(0, 0, 0);

	// 円筒オブジェクトの作成
	var cylinder = [];
	for(var i = 0; i < 2; i++) {
		cylinder.push(
			new THREE.Mesh(
			new THREE.CylinderGeometry(20, 20, 400, 10, 3, false),
			new THREE.MeshLambertMaterial({ color: 0xccccff })
		));
		cylinder[i].castShadow = true;
		cylinder[i].rotation.x = Math.PI * 0.5;
		cylinder[i].position.set(0, 0, 200);
		scene.add(cylinder[i]);
	}


	// メッシュをsceneへ追加
	scene.add(nikuMesh);
	scene.add(plane);

	// FEMの境界条件
	fem.gripRad = 20;
	fem.selectHoldNodes([[50, 50], [-50, -50]]);

	// レンダリング
	var baseTime = +new Date;
	var time;
	var step = 0;
	var disp = 0;
	function render() {
		time = (+new Date - baseTime) / 1000.0;
		requestAnimationFrame(render);

		dispx = 400 * Math.sin(step * 0.05) + 50;
		dispy = 200 * Math.cos(step * 0.03);
		cylinder[0].position.set(dispx, dispy, 200);
		cylinder[1].position.set(-50, -50, 200);
		fem.setBoundary("Down", [[dispx, dispy], [-50, -50]], false);

		fem.calcDynamicDeformation(0.1);
		for(var i = 0; i < fem.posNum; i++) {
			niku.vertices[i].x = fem.pos[i][0];
			niku.vertices[i].y = fem.pos[i][1];
			niku.vertices[i].z = 0.5 * thickness;
		}
		for(var i = 0; i < fem.posNum; i++) {
			niku.vertices[i + fem.posNum].x = fem.pos[i][0];
			niku.vertices[i + fem.posNum].y = fem.pos[i][1];
			niku.vertices[i + fem.posNum].z = -0.5 * thickness;
		}
		niku.computeFaceNormals();
		niku.computeVertexNormals();
		niku.verticesNeedUpdate = true;
		niku.normalsNeedUpdate = true;

		cameraCtrl.update();

		renderer.render(scene, camera);
		++step;
	};

	// リサイズに応じてレンダリング領域のサイズを変える
	window.addEventListener('resize', function () {
		renderer.setSize(0.95 * window.innerWidth, 0.95 * window.innerHeight);
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();
	}, false);

	render();
});
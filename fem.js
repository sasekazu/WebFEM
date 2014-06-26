////////////////////////////////////////////////////////////
// FEMクラスの定義
////////////////////////////////////////////////////////////
	
function FEM(initpos, tri){
	this.pos = numeric.mul(initpos,1);      // 節点現在位置
	this.initpos = numeric.mul(initpos,1);  // 節点初期位置

	this.pos.push([0,0]);	// ゴミを追加、こいつを固定点にすることで解が安定する
							// 行列計算の中でサイズゼロの行列が生じることを防ぐ
	this.initpos.push([0,0]);

	this.tri = numeric.mul(tri, 1); // 三角形要素の節点リスト
	this.Re = [];           // 要素回転マトリクス
	this.Be = [];           // 要素 ひずみマトリクス
	this.De = [];           // 要素 ひずみ-応力変換マトリクス
	this.Ke = [];           // 要素剛性マトリクス    
	var young = 100;       // ヤング率 [Pa]
	var poisson = 0.3;      // ポアソン比
	var density = 0.001;    // 密度 [kg/mm3]
	var thickness = 1;  // 物体の厚さ [mm]
	this.mass = [];     // 節点の等価質量
	this.alpha = 0.01;  // Mに作用するレイリー減衰のパラメータ
	this.beta = 0.01;    // Kに作用するレイリー減衰のパラメータ
	this.gravity = 100;

	// 要素剛性マトリクス作成
	this.makeMatrixKe(young, poisson, density, thickness);

	this.K = [];
	this.makeMatrixK();
	this.posNum = this.pos.length;
	this.triNum = this.tri.length;
	this.Vel = numeric.linspace(0,0,2*this.posNum);
	this.th = numeric.linspace(0,0,this.tri.length);
	this.foffset = numeric.linspace(0,0,2*this.posNum);
	this.flist = [];
	this.dlist = [];
	this.ff = [];
	this.ud = [];
	this.maxPStress = [];
	this.fixNode = []; // 固定ノードリスト: パブリックアクセスで外部から設定する
	// 破壊に関するメンバ変数
	this.removedFlag = new Array(this.tri.length);
	for(var i=0; i<this.tri.length; i++)
		this.removedFlag[i] = false;
	this.thrPStress = 5*young;

	// マウスでつまむためのメンバ変数
	this.holdNode = [];
	this.mousePosClick = [];
	this.uClick = []; // setBoundaryのためのメンバ, クリック時のUベクトル
	this.gripRad = 50; // setBoudaryにおける周辺拘束領域の半径
}

FEM.prototype.makeMatrixKe = function(young, poisson, density, thickness){
	// Bマトリクスを作成
	var TriNum = this.tri.length;
	this.Be = new Array(TriNum);
	for(var i=0; i<TriNum; i++){
		this.Be[i] = makeMatrixB(this.pos[this.tri[i][0]], this.pos[this.tri[i][1]], this.pos[this.tri[i][2]]);
	}
	// Dマトリクスを作成
	this.De = new Array(TriNum);
	for (var i = 0; i < TriNum; i++) {
		this.De[i] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
		var tmp = young / (1.0 - poisson * poisson);
		this.De[i][0][0] = tmp;
		this.De[i][0][1] = poisson * tmp;
		this.De[i][1][0] = poisson * tmp;
		this.De[i][1][1] = tmp;
		this.De[i][2][2] = 0.5 * (1 - poisson) * tmp;
	}
	// Keマトリクスを作成
	var KeTmp;
	var Bt;
	var posMat;
	var area;
	this.mass = numeric.linspace(0,0,this.pos.length);
	for(var i=0; i<TriNum; i++){
		Bt = numeric.transpose(this.Be[i]);
		KeTmp = numeric.dot(this.De[i],this.Be[i]);
		KeTmp = numeric.dot(Bt,KeTmp);
		posMat =  [
		[1,this.pos[this.tri[i][0]][0],this.pos[this.tri[i][0]][1]], 
		[1,this.pos[this.tri[i][1]][0],this.pos[this.tri[i][1]][1]], 
		[1,this.pos[this.tri[i][2]][0],this.pos[this.tri[i][2]][1]] ];
		area = 0.5 * numeric.det(posMat);
		area = Math.abs(area);
		KeTmp = numeric.mul(KeTmp,area*thickness);
		this.Ke.push(KeTmp);
		
		for(var j=0; j<3; j++)
			this.mass[this.tri[i][j]] += area * density * thickness * 0.333333;			
	}
	// stress, maxPStressの初期化
	this.stress = new Array(TriNum);
	for (var i = 0; i < TriNum; i++) {
		this.stress[i] = [0, 0, 0];
	}
	this.maxPStress = numeric.linspace(0, 0, TriNum);

	// Reの初期化
	this.Re = new Array(TriNum);
	for(var i=0; i<TriNum; i++){
		this.Re[i] = numeric.identity(6);
	}
}

// 三角形定ひずみ要素の全体剛性マトリクスを作成する関数
FEM.prototype.makeMatrixK = function(){
	this.K = numeric.rep([2*this.pos.length,2*this.pos.length],0);
	for(var i=0; i<this.tri.length; i++){
		for(var j=0; j<3; j++){
			for(var k=0; k<3; k++){
				for(var l=0; l<2; l++){
					for(var m=0; m<2; m++){
						this.K[2*this.tri[i][j]+l][2*this.tri[i][k]+m] += this.Ke[i][2*j+l][2*k+m];
					}
				}
			}
		}
	}
}


// クリック時の処理
FEM.prototype.selectHoldNodes = function(mousePos){	

	this.mousePosClick = new Array(mousePos.length);
	for(var i=0; i<mousePos.length; i++){
		this.mousePosClick[i] = new Array(2);
		this.mousePosClick[i][0] = mousePos[i][0];
		this.mousePosClick[i][1] = mousePos[i][1];
	}
		
	
	
	this.uClick = new Array(mousePos.length);
	for(var i=0; i<mousePos.length; i++){
		this.uClick[i] = numeric.linspace(0,0,2*this.pos.length);
	}
	
	this.holdNode = new Array(mousePos.length);
	for(var i=0; i<mousePos.length; i++){
		this.holdNode[i] = [];				
	}
	
	var dif;
	var dist;
	for(var cl=0; cl<mousePos.length; cl++){
		for(var i=0; i<this.pos.length; i++){
			dif = numeric.sub(mousePos[cl],this.pos[i]);
			dist = numeric.norm2(dif);
			if(this.gripRad > dist){
				this.uClick[cl][2*i] = this.pos[i][0]-this.initpos[i][0];
				this.uClick[cl][2*i+1] = this.pos[i][1]-this.initpos[i][1];
				this.holdNode[cl].push(i);
			}
		}
	}
}


// 境界条件の設定
FEM.prototype.setBoundary = function(clickState, mousePos, gravityFlag){
	
	if(mousePos.length != this.holdNode.length)
		this.selectHoldNodes(mousePos);
	
	this.dlist = [];
	this.flist = [];
	this.ud = [];
	this.ff = [];
	
	var nodeToDF = numeric.linspace(0,0,this.posNum);
	var u = numeric.linspace(0,0,2*this.posNum);
	var f = numeric.linspace(0,0,2*this.posNum);

	// 固定ノードの境界条件
	for(var i=0; i<this.fixNode.length; i++) {
		var nd=this.fixNode[i];
		u[2*nd] = this.pos[nd][0]-this.initpos[nd][0];
		u[2*nd+1]=this.pos[nd][1]-this.initpos[nd][1];
		nodeToDF[nd]="d";
	}
	
	// 上面のノードを固定
	for(var i=0; i<this.pos.length; i++){
		if(i==this.pos.length-1){
			u[2*i] = 0;
			u[2*i+1] = 0;
			nodeToDF[i] = "d";
		}else if(nodeToDF[i]!="d"){
			f[2*i] = 0;
			if(gravityFlag)
				f[2*i+1] = this.gravity * this.mass[i];
			else
				f[2*i+1] = 0;
			
			nodeToDF[i] = "f";
		}
	}
	
	// クリックノードの境界条件
	if(clickState == "Down"){
		for(var cl=0; cl<mousePos.length; cl++){
			for(var i=0; i<this.holdNode[cl].length; i++){
				var nd = this.holdNode[cl][i];
				if(nodeToDF[nd]=="d")continue;
				u[2*nd]   = this.uClick[cl][2*nd]+mousePos[cl][0]-this.mousePosClick[cl][0];
				u[2*nd+1] = this.uClick[cl][2*nd+1]+mousePos[cl][1]-this.mousePosClick[cl][1];
				nodeToDF[nd] = "d";
			}	
		}
	}
	
		
	for(var i=0; i<this.pos.length; i++){
		if(nodeToDF[i] == "d"){
			this.dlist.push(i);
			this.ud.push(u[2*i]);
			this.ud.push(u[2*i+1]);
		}else{
			this.flist.push(i);
			this.ff.push(f[2*i]);
			this.ff.push(f[2*i+1]);
		}
	}
}



// Stiffness Warpe 法のためのKマトリクスを作成する
// modeはMovingAverageかNormal
FEM.prototype.makeMatrixKSW = function(){
	var TriNum = this.tri.length;
	this.K = numeric.rep([2*this.pos.length,2*this.pos.length],0);
	var RK = numeric.rep([2*this.pos.length,2*this.pos.length],0);
	
	for(var i=0; i<TriNum; i++){
		// 削除された要素は計算しない
		if(this.removedFlag[i]) continue;
		
		// 要素の回転角度取得
		var center0 = [0,0];
		for(var j=0; j<3; j++)
			center0 = numeric.add(center0, this.initpos[this.tri[i][j]]);
			
		center0 = numeric.mul(center0, 0.333333333333);
		
		var center = [0,0];
		for(var j=0; j<3; j++)
			center = numeric.add(center, this.pos[this.tri[i][j]]);
			
		center = numeric.mul(center, 0.333333333333);
		
		var q = numeric.rep([3,2],0);
		for(var j=0; j<3; j++)
			q[j] = numeric.sub(this.initpos[this.tri[i][j]],center0)
		
		var p = numeric.rep([3,2],0);
		for(var j=0; j<3; j++)
			p[j] = numeric.sub(this.pos[this.tri[i][j]],center)
		
		var A = 0;
		for(var j=0; j<3; j++)
			A += q[j][1]*p[j][0] - q[j][0]*p[j][1];
		
		var B = 0;
		for(var j=0; j<3; j++)
			B += q[j][0]*p[j][0] + q[j][1]*p[j][1];

		// 回転角度の計算
		var th_now = -Math.PI/2.0+Math.atan2(B,A);
		
		// 安定化のために回転場の移動平均
		// atan2の不連続性を考慮して前回との開き角度が180度を超えた場合は
		// 鋭角側の差をとることにする
		/*
		if(Math.abs(th_now-this.th[i])<Math.PI)
			this.th[i] = (th_now + this.th[i]) * 0.5;
		else
			this.th[i] = (th_now + this.th[i]) * 0.5 + Math.PI;
		*/
		this.th[i] = th_now;
			
		
		// 回転行列の作成
		var ReMini = [[Math.cos(this.th[i]),-Math.sin(this.th[i])],[Math.sin(this.th[i]),Math.cos(this.th[i])]];
		
		for(var j=0; j<3; j++)
			for(var k=0; k<2; k++)
				for(var l=0; l<2; l++)
					this.Re[i][2*j+k][2*j+l]=ReMini[k][l];

		// StiffnessWarpingの効果を無効にしたいときは
		// コメントアウトを外して回転行列を単位行列にする
		//this.Re[i] = numeric.identity(6);

		var ReInv=numeric.transpose(this.Re[i]);


		// 要素剛性マトリクス作成
		var KeTmp = numeric.dot(this.Ke[i],ReInv);
		KeTmp = numeric.dot(this.Re[i],KeTmp);


		// 全体剛性マトリクス作成
		for(var j=0; j<3; j++)
			for(var k=0; k<3; k++)
				for(var l=0; l<2; l++)
					for(var m=0; m<2; m++)
						this.K[2*this.tri[i][j]+l][2*this.tri[i][k]+m] += KeTmp[2*j+l][2*k+m];
		
		// 力オフセット作成のための回転剛性マトリクス作成
		var RKeTmp = numeric.dot(this.Re[i],this.Ke[i]);
		for(var j=0; j<3; j++)
			for(var k=0; k<3; k++)
				for(var l=0; l<2; l++)
					for(var m=0; m<2; m++)
						RK[2*this.tri[i][j]+l][2*this.tri[i][k]+m] += RKeTmp[2*j+l][2*k+m];
						
	}

	
	// 力オフセット合成
	var initposVec = numeric.linspace(0,0,2*this.posNum);
	for(var i=0; i<this.posNum; i++)
		for(var j=0; j<2; j++)
			initposVec[2*i+j] = this.initpos[i][j];
	this.foffset = numeric.dot(RK,initposVec);
	this.foffset=numeric.neg(this.foffset);

}


// 境界条件を設定して変形計算を行う
// 境界条件は y=0 を固定，ノード番号spNodeに強制変位disp[2]を与える
// modeはStiffnessWarpingかNormal
FEM.prototype.calcDeformation = function(){
	
	// Stiffness Warping法の場合、剛性マトリクスを修正する
	this.makeMatrixKSW();
	
	var f = this.flist.length;
	var d = this.dlist.length;
	
	var Kff = numeric.rep([2*f,2*f],0);
	for(var i=0; i<f; i++)
		for(var j=0; j<f; j++)
			for(var k=0; k<2; k++)
				for(var l=0; l<2; l++)
					Kff[2*i+k][2*j+l] = this.K[2*this.flist[i]+k][2*this.flist[j]+l];
	
	var Kfd = numeric.rep([2*f,2*d],0);
	for(var i=0; i<f; i++)
		for(var j=0; j<d; j++)
			for(var k=0; k<2; k++)
				for(var l=0; l<2; l++)
					Kfd[2*i+k][2*j+l] = this.K[2*this.flist[i]+k][2*this.dlist[j]+l];

	var xd = numeric.linspace(0,0,2*d);
	for(var i=0; i<d; i++){
		for(var j=0; j<2; j++){
			xd[2*i+j] = this.initpos[this.dlist[i]][j] + this.ud[2*i+j];
		}
	}

	var felastic = numeric.linspace(0,0,2*f);
	for(var i=0; i<f; i++){
		for(var j=0; j<2; j++){
			felastic[2*i+j] = - this.foffset[2*this.flist[i]+j];
		}
	}
	
	var y = numeric.dot(Kfd,xd);
	y = numeric.sub(felastic,y);
	y = numeric.add(y, this.ff);
	var xf = numeric.solve(Kff,y);
	
	for(var i=0; i<f; i++)
		for(var j=0; j<2; j++)
			this.pos[this.flist[i]][j] = xf[2*i+j];
			
	for(var i=0; i<d; i++)
		for(var j=0; j<2; j++)
			this.pos[this.dlist[i]][j] = this.initpos[this.dlist[i]][j] + this.ud[2*i+j];
			
}



// 境界条件を設定して変形計算を行う
// 境界条件は y=0 を固定，ノード番号spNodeに強制変位disp[2]を与える
FEM.prototype.calcDynamicDeformation = function(dt){

	// Stiffness Warping法の場合、剛性マトリクスを修正する
	this.makeMatrixKSW();

	var f = this.flist.length;
	var d = this.dlist.length;
			
	var uf = numeric.linspace(0,0,2*f);
	for(var i=0; i<f; i++)
		for(var j=0; j<2; j++)
			uf[2*i+j] = this.pos[this.flist[i]][j] - this.initpos[this.flist[i]][j];
		
	var vf = numeric.linspace(0,0,2*f);
	for(var i=0; i<f; i++)
		for(var j=0; j<2; j++)
			vf[2*i+j] = this.Vel[2*this.flist[i]+j];
	
	var Kff = numeric.rep([2*f,2*f],0);
	for(var i=0; i<f; i++)
		for(var j=0; j<f; j++)
			for(var k=0; k<2; k++)
				for(var l=0; l<2; l++)
					Kff[2*i+k][2*j+l] = this.K[2*this.flist[i]+k][2*this.flist[j]+l];
	
	var Kfd = numeric.rep([2*f,2*d],0);
	for(var i=0; i<f; i++)
		for(var j=0; j<d; j++)
			for(var k=0; k<2; k++)
				for(var l=0; l<2; l++)
					Kfd[2*i+k][2*j+l] = this.K[2*this.flist[i]+k][2*this.dlist[j]+l];
	
	var M = numeric.identity(2*f);
	for(var i=0; i<f; i++){
		M[2*i][2*i] = this.mass[this.flist[i]];
		M[2*i+1][2*i+1] = this.mass[this.flist[i]];
	}
		
	var xd = numeric.linspace(0,0,2*d);
	for(var i=0; i<d; i++)
		for(var j=0; j<2; j++)
			xd[2*i+j] = this.initpos[this.dlist[i]][j] + this.ud[2*i+j];
	
	var xf = numeric.linspace(0,0,2*f);
	for(var i=0; i<f; i++)
		for(var j=0; j<2; j++)
			xf[2*i+j] = this.pos[this.flist[i]][j];

	var fof = numeric.linspace(0,0,2*f);
	for(var i=0; i<f; i++)
		for(var j=0; j<2; j++)
			fof[2*i+j] = this.foffset[2*this.flist[i]+j];
	
	var Mleft1 = numeric.mul(M,(1+this.alpha));
	var Mleft2 = numeric.mul(Kff,dt*(this.beta+dt));
	var Mleft = numeric.add(Mleft1,Mleft2);


	var Mright1 = numeric.dot(M,vf);
	var Mright2 = numeric.dot(Kff,xf);

	Mright2 = numeric.neg(Mright2);
	var tmp = numeric.dot(Kfd,xd);
	Mright2 = numeric.sub(Mright2, tmp);
	Mright2 = numeric.sub(Mright2, fof);
	Mright2 = numeric.add(Mright2, this.ff);
	Mright2 = numeric.mul(Mright2, dt);
	var Mright = numeric.add(Mright1, Mright2);
	

	vf = numeric.solve(Mleft, Mright);
	
	for(var i=0; i<f; i++)
		for(var j=0; j<2; j++)
			this.Vel[2*this.flist[i]+j]=vf[2*i+j];

	for(var i=0; i<d; i++)
		for(var j=0; j<2; j++)
			this.Vel[2*this.dlist[i]+j]=(this.ud[2*i+j]-(this.pos[this.dlist[i]][j]-this.initpos[this.dlist[i]][j]))/dt;

	var duf = numeric.mul(dt,vf);
	uf = numeric.add(uf,duf);
	for(var i=0; i<f; i++)
		for(var j=0; j<2; j++)
			this.pos[this.flist[i]][j] = this.initpos[this.flist[i]][j] + uf[2*i+j];
	
	for(var i=0; i<d; i++)
		for(var j=0; j<2; j++)
			this.pos[this.dlist[i]][j] = this.initpos[this.dlist[i]][j] + this.ud[2*i+j];
}	


FEM.prototype.modifyPosCld = function(xmin, ymin, xmax, ymax){
	for(var i=0; i<this.pos.length; i++) {
		if(this.pos[i][0]<xmin) {
			this.pos[i][0]=xmin;
			this.Vel[2*i] = 0;
			this.Vel[2*i+1] = 0;
		}
		if(this.pos[i][0]>xmax) {
			this.pos[i][0]=xmax;
			this.Vel[2*i] = 0;
			this.Vel[2*i+1] = 0;
		}
		if(this.pos[i][1]<ymin) {
			this.pos[i][1]=ymin;
			this.Vel[2*i] = 0;
			this.Vel[2*i+1] = 0;
		}
		if(this.pos[i][1]>ymax) {
			this.pos[i][1]=ymax;
			this.Vel[2*i] = 0;
			this.Vel[2*i+1] = 0;
		}
	}
}
	

FEM.prototype.calcStress = function () {
	for (var i = 0; i < this.tri.length; i++) {
		var xe = [0,0,0,0,0,0];
		for(var j=0; j<3; j++){
			xe[2*j] = this.pos[this.tri[i][j]][0];
			xe[2*j+1] = this.pos[this.tri[i][j]][1];
		}
		var x0e = [0,0,0,0,0,0];
		for(var j=0; j<3; j++){
			x0e[2*j] = this.initpos[this.tri[i][j]][0];
			x0e[2*j+1] = this.initpos[this.tri[i][j]][1];
		}
		var ReInv = numeric.transpose(this.Re[i]);
		var strain = numeric.dot(ReInv,xe);
		strain = numeric.sub(strain,x0e);
		var tmp = numeric.dot(this.De[i],this.Be[i]);
		var stress = numeric.dot(tmp,strain);
		var sigma1 = (stress[0]+stress[1])*0.5+Math.sqrt((stress[0]-stress[1])*(stress[0]-stress[1])*0.25+stress[2]*stress[2]);
		var sigma2 = (stress[0]+stress[1])*0.5-Math.sqrt((stress[0]-stress[1])*(stress[0]-stress[1])*0.25+stress[2]*stress[2]);
		if(Math.abs(sigma1)>Math.abs(sigma2)) {
			this.maxPStress[i]=Math.abs(sigma1);
		} else {
			this.maxPStress[i]=Math.abs(sigma2);
		}
	}
}


FEM.prototype.removeElement=function () {
	for(var i=0; i<this.tri.length; i++) {
		if(this.maxPStress[i]>this.thrPStress) {
			this.removedFlag[i] = true;
		}
	}
}


// 三角形定ひずみ要素の要素Bマトリクスを作成する関数
function makeMatrixB(p1,p2,p3){
	var Be = [[0,0,0,0,0,0],[0,0,0,0,0,0],[0,0,0,0,0,0]];
	var mat = [[1,p1[0],p1[1]], [1,p2[0],p2[1]], [1,p3[0],p3[1]]];
	var delta = numeric.det(mat);
	var dd = 1.0/delta;
	Be[0][0] = (p2[1]-p3[1])*dd;
	Be[0][2] = (p3[1]-p1[1])*dd;
	Be[0][4] = (p1[1]-p2[1])*dd;
	Be[1][1] = (p3[0]-p2[0])*dd;
	Be[1][3] = (p1[0]-p3[0])*dd;
	Be[1][5] = (p2[0]-p1[0])*dd;
	Be[2][0] = (p3[0]-p2[0])*dd;
	Be[2][1] = (p2[1]-p3[1])*dd;
	Be[2][2] = (p1[0]-p3[0])*dd;
	Be[2][3] = (p3[1]-p1[1])*dd;
	Be[2][4] = (p2[0]-p1[0])*dd;
	Be[2][5] = (p1[1]-p2[1])*dd;
	return Be;
}

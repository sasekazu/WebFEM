
// 四角形メッシュのノード位置配列
function RectangleMesh(width, height, divx, divy) {
	this.Pos = [];
	this.Tri = [];
	this.maxx = width*0.5;
	this.maxy = height*0.5;
	this.minx = -width*0.5;
	this.miny = -height*0.5;
	for(var i=0; i<divy+1; i++) {
		for(var j=0; j<divx+1; j++) {
			this.Pos.push([width/divx*j-width*0.5, height/divy*i-height*0.5]);
		}
	}
	for(var i=0; i<divy; i++) {
		for(var j=0; j<divx; j++) {
			this.Tri.push([j+(divx+1)*i, j+1+(divx+1)*i, j+(divx+1)*(i+1)]);
			this.Tri.push([j+1+(divx+1)*i, j+1+(divx+1)*(i+1), j+(divx+1)*(i+1)]);
		}
	}
}
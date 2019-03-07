var tmpDir = null;
var preTime = 0;

var vbsBg =`
Dim objPPT
Dim preVal
Dim ap
Set objPPT = CreateObject("PowerPoint.Application")
On Error Resume Next
Sub Proc(preVal)
	Dim sl
	Dim shGroup
	Dim sngWidth
	Dim sngHeight
	With ap.PageSetup
		sngWidth = .SlideWidth
		sngHeight = .SlideHeight
	End With
	Set objSlideShow = ap.SlideShowWindow.View
	With ap.Slides(objSlideShow.CurrentShowPosition)
		.Export Wscript.Arguments.Item(0) & "/Slide.png", "PNG"
	End With
End Sub
sub Main()
	objPPT.DisplayAlerts = False
	preVal = 0
	Do While True
		On Error Resume Next
		Set ap = objPPT.ActivePresentation
		If Err.Number = 0 Then
			If preVal = 0 Then
				preVal = ap.SlideShowWindow.View.CurrentShowPosition
				Proc(preVal)
			ElseIf (ap.SlideShowWindow.View.CurrentShowPosition <> preVal) Then
				preVal = ap.SlideShowWindow.View.CurrentShowPosition
				Proc(preVal)
			End If
		End If
		WScript.Sleep(250)
	Loop
End Sub
Main
`;

var vbsNoBg =`
Dim objPPT
Dim preVal
Dim ap
Set objPPT = CreateObject("PowerPoint.Application")
On Error Resume Next
Sub Proc(preVal)
	Dim sl
	Dim shGroup
	Dim sngWidth
	Dim sngHeight
	With ap.PageSetup
		sngWidth = .SlideWidth
		sngHeight = .SlideHeight
	End With
	Set objSlideShow = ap.SlideShowWindow.View
	With ap.Slides(objSlideShow.CurrentShowPosition)
		With .Shapes.AddTextBox( 1, 0, 0, sngWidth, sngHeight)
			.TextFrame.TextRange = ""
			Set shpGroup = ap.Slides(objSlideShow.CurrentShowPosition).Shapes.Range()
			shpGroup.Export Wscript.Arguments.Item(0) & "/Slide.png", _
								2, , , 1
			.Delete
		End With
		Wscript.Echo "PPTNDI: Sent"
	End With
End Sub
sub Main()
	objPPT.DisplayAlerts = False
	preVal = 0
	Do While True
		On Error Resume Next
		Set ap = objPPT.ActivePresentation
		If Err.Number = 0 Then
			If preVal = 0 Then
				preVal = ap.SlideShowWindow.View.CurrentShowPosition
				Proc(preVal)
			ElseIf (ap.SlideShowWindow.View.CurrentShowPosition <> preVal) Then
				preVal = ap.SlideShowWindow.View.CurrentShowPosition
				Proc(preVal)
			End If
		End If
		WScript.Sleep(250)
	Loop
End Sub
Main
`;

$(document).ready(function() {
	const spawn = require( 'child_process' ).spawn;
	const ipc = require('electron').ipcRenderer;
	const fs = require("fs-extra");
	const binPath = './bin/PPTNDI.EXE';
	var child;
	var res;

	function runBin() {
		if (fs.existsSync(binPath)) {
			child = spawn(binPath);
			//child.on('exit', function (code) {
			//	alert("EXITED " + code);
			//});
		} else {
			alert('Failed to create a listening server!');
			ipc.send('remote', "exit");
			return;
		}
	}

	function init() {
		var file;
		var vbsDir;
		var newVbsContent;
		var now = new Date().getTime();
		runBin();
		child.stdin.setEncoding('utf-8');
		child.stdout.pipe(process.stdout);

		tmpDir = process.env.TEMP + '/ppt_ndi';
		if (!fs.existsSync(tmpDir)) {
			fs.mkdirSync(tmpDir);
		}
		tmpDir += '/' + now;
		fs.mkdirSync(tmpDir);
		vbsDir = tmpDir + '/wb.vbs';
		file = tmpDir + "/Slide.png";

		newVbsContent = vbsNoBg;
		try {
			fs.writeFileSync(vbsDir, newVbsContent, 'utf-8');
		} catch(e) {
			alert('Failed to access the temporary directory!');
			return;
		}
		if (fs.existsSync(vbsDir)) {
			res = spawn( 'cscript.exe', [ vbsDir, tmpDir, '' ] );
			res.stdout.on('data', function(data) {
				if (/^PPTNDI: Sent/.test(data.toString())) {
					var now2 = new Date().getTime();
					$("#slidePreview").attr("src", file + "?" + now2);
					try {
						child.stdin.write(file + "\n");
					} catch(e) {
						child = spawn(binPath);
						child.stdin.write(file + "\n");
					}
				}
			});
		} else {
			alert('Failed to parse the presentation!');
			return;
		}
	}

	function cleanupForTemp() {
		if (fs.existsSync(tmpDir)) {
			fs.removeSync(tmpDir);
		}
	}

	function cleanupForExit() {
		try {
			child.stdin.write("destroy\n");
		} catch(e) {
		}
		cleanupForTemp();
		ipc.send('remote', "exit");
	}

	ipc.on('remote' , function(event, data){
		if (data.msg == "exit") {
			cleanupForExit();
		}
	});

	$('#closeImg').click(function() {
		cleanupForExit();
	});

	$('#bk').click(function() {
		var newVbsContent;
		var vbsDir = tmpDir + '/wb.vbs';
		if ($("#bk").is(":checked")) {
			newVbsContent = vbsBg;
			try {
				fs.writeFileSync(vbsDir, newVbsContent, 'utf-8');
			} catch(e) {
				alert('Failed to access the temporary directory!');
				return;
			}
		} else {
			newVbsContent = vbsNoBg;
			try {
				fs.writeFileSync(vbsDir, newVbsContent, 'utf-8');
			} catch(e) {
				alert('Failed to access the temporary directory!');
				return;
			}
		}
		res.stdin.pause();
		res.kill();
		if (fs.existsSync(vbsDir)) {
			res = spawn( 'cscript.exe', [ vbsDir, tmpDir, '' ] );
		} else {
			alert('Failed to parse the presentation!');
			return;
		}
	});

	init();
});

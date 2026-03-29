#target illustrator

function main() {

    var doc = app.activeDocument;
    var rulerUnits = doc.rulerUnits;
    var unitLabel = "mm";
    var unitToPt = 2.83465;

    if (rulerUnits === RulerUnits.Centimeters) {
        unitLabel = "cm";
        unitToPt = 28.3465;
    } else if (rulerUnits === RulerUnits.Inches) {
        unitLabel = "inch";
        unitToPt = 72;
    } else if (rulerUnits === RulerUnits.Points) {
        unitLabel = "pt";
        unitToPt = 1;
    } else if (rulerUnits === RulerUnits.Picas) {
        unitLabel = "peak";
        unitToPt = 12;
    } else if (rulerUnits === RulerUnits.Pixels) {
        unitLabel = "px";
        var docResolution = (doc.documentColorSpace !== undefined && doc.rasterResolution) ? doc.rasterResolution : 72;
        unitToPt = 72 / docResolution;
    }

    var patterns = {
        L: {
            0: "0001101", 1: "0011001", 2: "0010011", 3: "0111101", 4: "0100011",
            5: "0110001", 6: "0101111", 7: "0111011", 8: "0110111", 9: "0001011"
        },
        G: {
            0: "0100111", 1: "0110011", 2: "0011011", 3: "0100001", 4: "0011101",
            5: "0111001", 6: "0000101", 7: "0010001", 8: "0001001", 9: "0010111"
        },
        R: {
            0: "1110010", 1: "1100110", 2: "1101100", 3: "1000010", 4: "1011100",
            5: "1001110", 6: "1010000", 7: "1000100", 8: "1001000", 9: "1110100"
        }
    };

    var structure = {
        0: "LLLLLL", 1: "LLGLGG", 2: "LLGGLG", 3: "LLGGGL", 4: "LGLLGG",
        5: "LGGLLG", 6: "LGGGLL", 7: "LGLGLG", 8: "LGLGGL", 9: "LGGLGL"
    };

    function checksum(code) {
        var sum = 0;
        for (var i = 0; i < 12; i++) {
            var digit = parseInt(code[i]);
            sum += (i % 2 === 0) ? digit : digit * 3;
        }
        return (10 - (sum % 10)) % 10;
    }

    function generateBarcodeBinary(fullCode) {
        var parity = structure[parseInt(fullCode[0])];
        var code = "101";
        for (var i = 1; i <= 6; i++) {
            code += patterns[parity[i - 1]][parseInt(fullCode[i])];
        }
        code += "01010";
        for (var i = 7; i <= 12; i++) {
            code += patterns.R[parseInt(fullCode[i])];
        }
        code += "101";
        return code;
    }

    var dialog = new Window("dialog", "EAN-13 bar-code generator");
    dialog.orientation = "column";
    dialog.alignChildren = "center";

    var tPanel = dialog.add("tabbedpanel");
    tPanel.preferredSize =[364, 330]; 

    var tabs = [];
    var tabLabels =["Options", "Proportions", "Position"];
    for (var t = 0; t < 3; t++) {
        var tab = tPanel.add("tab", undefined, tabLabels[t]);
        tab.orientation = "column";
        tab.alignChildren = "center";
        tab.spacing = 8;
        tab.margins =[10, 10, 10, 10];
        tabs.push(tab);
    }

    function switchTab(idx) {
        tPanel.selection = tabs[idx];
    }

    var tab1 = tabs[0];
    tab1.alignChildren = "left";

    tab1.add("statictext", undefined, "Enter the 12 digit bar-code:");

    var inputRow = tab1.add("group");
    inputRow.orientation = "row";
    inputRow.alignChildren = "center";
    inputRow.alignment = "left";
    inputRow.margins =[0, 0, 5, 0];

    var inputField = inputRow.add("edittext", undefined, "");
    inputField.characters = 32;
    inputField.active = true;

    var checksumLabel = inputRow.add("statictext", undefined, "");
    checksumLabel.characters = 1;

    var checksGroup = tab1.add("group");
    checksGroup.orientation = "column";
    checksGroup.alignChildren = "left";
    checksGroup.alignment = "left";
    
    var quietZoneCheckbox = checksGroup.add("checkbox", undefined, "Add a '>' label to the right (Quiet Zone)");
    var whiteBgCheckbox = checksGroup.add("checkbox", undefined, "Add a white background");
    whiteBgCheckbox.value = false;

    var previewPanel = tab1.add("panel", undefined, "Preview:");
    previewPanel.orientation = "column";
    previewPanel.alignChildren = "center";
    previewPanel.alignment = ["fill", "top"];
    previewPanel.margins = 10;
    
    var previewCanvas = previewPanel.add("group");
    previewCanvas.preferredSize =[320, 110];
    var currentBarcodeBinary = "";

    function drawSharedPreview(canvas) {
        var g = canvas.graphics;
        var w = canvas.size[0];
        var h = canvas.size[1];

        var sysBg = g.newBrush(g.BrushType.SOLID_COLOR,[0.93, 0.93, 0.93, 1]);
        g.newPath();
        g.rectPath(0, 0, w, h);
        g.fillPath(sysBg);

        var fontMsg = ScriptUI.newFont("Arial", "REGULAR", 12);

        if (!currentBarcodeBinary) {
            var penGray = g.newPen(g.PenType.SOLID_COLOR,[0.5, 0.5, 0.5, 1], 1);
            var msg = "Please enter 12 digits...";
            var dim = g.measureString(msg, fontMsg);
            g.drawString(msg, penGray, (w - dim[0]) / 2, (h - 12) / 2, fontMsg);
            return;
        }

        var doBg = whiteBgCheckbox.value;
        var doQZ = quietZoneCheckbox.value;
        var pctStr = (typeof barHeightInput !== 'undefined') ? barHeightInput.text.replace(",", ".") : "76";
        var pct = parseFloat(pctStr);
        if (isNaN(pct) || pct <= 0) pct = 76;

        var moduleWidth = 0.94;
        var totalBase = 60;
        var barHeight = totalBase * (pct / 100);
        var longBarHeight = barHeight + 6;
        var textHeight = 9.5;

        var val = inputField.text;
        var check = checksumLabel.text;
        var fullCode = val + check;

        var minX = -moduleWidth * 7; 

        var maxX = doQZ 
            ? moduleWidth * 95.5 + (textHeight * 0.65) 
            : moduleWidth * 95;

        var contentW = maxX - minX;

        var contentH = barHeight + (textHeight * 0.85);

        var pad = contentW * 0.05;
        var padR = contentW * 0.10;

        var totalW = doBg ? (contentW + pad + padR) : contentW;
        var totalH = doBg ? (contentH + pad * 2) : contentH;

        var scale = Math.min(w / totalW, h / totalH) * 0.95;

        var drawW = totalW * scale;
        var drawH = totalH * scale;

        var offsetX = (w - drawW) / 2;
        var offsetY = (h - drawH) / 2;

        if (doBg) {
            var bgBrush = g.newBrush(g.BrushType.SOLID_COLOR, [1, 1, 1, 1]);
            g.newPath();
            g.rectPath(offsetX, offsetY, drawW, drawH);
            g.fillPath(bgBrush);
        }

        var originX = offsetX + (doBg ? pad * scale : 0) - minX * scale;
        var originY = offsetY + (doBg ? pad * scale : 0);

        var brush = g.newBrush(g.BrushType.SOLID_COLOR,[0, 0, 0, 1]);
        var textPen = g.newPen(g.PenType.SOLID_COLOR, [0, 0, 0, 1], 1);
        
        var currentX = originX;
        var i = 0;
        while (i < currentBarcodeBinary.length) {
            if (currentBarcodeBinary[i] === "1") {
                var isGuard = (i < 3 || (i >= 45 && i < 50) || i >= 92);
                var bh = isGuard ? longBarHeight : barHeight;

                var widthCount = 1;
                while (i + 1 < currentBarcodeBinary.length && currentBarcodeBinary[i + 1] === "1") {
                    var nextIdx = i + 1;
                    var nextIsGuard = (nextIdx < 3 || (nextIdx >= 45 && nextIdx < 50) || nextIdx >= 92);
                    if (nextIsGuard !== isGuard) break;
                    widthCount++;
                    i++;
                }

                g.newPath();
                g.rectPath(currentX, originY, moduleWidth * widthCount * scale, bh * scale);
                g.fillPath(brush);

                currentX += moduleWidth * widthCount * scale;
            } else {
                currentX += moduleWidth * scale;
            }
            i++;
        }

        var fontSize = textHeight * scale;
        var digitFont;
        try {
            digitFont = ScriptUI.newFont("ocrb10", "REGULAR", fontSize);
        } catch (e) {
            digitFont = ScriptUI.newFont("Arial", "REGULAR", fontSize);
        }

        var textY = originY + barHeight * scale + (-2 * scale); 
        
        function drawCenteredText(str, cx) {
            var dim = g.measureString(str, digitFont);
            g.drawString(str, textPen, cx - dim[0] / 2, textY, digitFont);
        }

        function drawLeftText(str, lx) {
            g.drawString(str, textPen, lx, textY, digitFont);
        }

        drawLeftText(fullCode[0], originX - moduleWidth * 7 * scale);

        for (var k = 1; k <= 6; k++) {
            var cx = originX + (moduleWidth * (3 + (k - 1) * 7) + moduleWidth * 3.5) * scale + (-1.5 * scale);
            drawCenteredText(fullCode[k], cx);
        }

        for (var m = 7; m <= 12; m++) {
            var cx = originX + (moduleWidth * (50 + (m - 7) * 7) + moduleWidth * 3.5) * scale + (-2 * scale);
            drawCenteredText(fullCode[m], cx);
        }

        if (doQZ) {
            var lx = originX + (moduleWidth * (50 + 6 * 7) + moduleWidth * 3.5) * scale + (-1 * scale);
            drawLeftText(">", lx);
        }
    }

    previewCanvas.onDraw = function() { drawSharedPreview(this); };

    function forceRedraw() {
        if (typeof previewCanvas !== 'undefined') {
            previewCanvas.hide();
            previewCanvas.show();
        }
        if (typeof previewCanvas2 !== 'undefined') {
            previewCanvas2.hide();
            previewCanvas2.show();
        }
    }

    inputField.onChanging = function () { updateChecksumLabel(); };

    function updateChecksumLabel() {
        var val = inputField.text;
        if (val.match(/^\d{12}$/)) {
            var check = checksum(val);
            checksumLabel.text = check;
            currentBarcodeBinary = generateBarcodeBinary(val + check);
        } else {
            checksumLabel.text = "";
            currentBarcodeBinary = "";
        }
        forceRedraw();
    }

    quietZoneCheckbox.onClick = forceRedraw;
    whiteBgCheckbox.onClick = forceRedraw;

    var tab2 = tabs[1];
    tab2.alignChildren = "left";

    var baseWidth  = 30 / 2.83465 * unitToPt;
    var baseHeight = 17.104 / 2.83465 * unitToPt;

    tab2.add("statictext", undefined, "Bar-code size (" + unitLabel + "):");

    var sizeGroup = tab2.add("group");
    sizeGroup.orientation = "row";
    sizeGroup.alignChildren = "center";

    sizeGroup.add("statictext", undefined, "Width:");
    var defaultW = (30 / 2.83465 * unitToPt).toFixed(3);
    var widthInput = sizeGroup.add("edittext", undefined, defaultW);
    widthInput.characters = 6;
    sizeGroup.add("statictext", undefined, unitLabel);
    sizeGroup.add("statictext", undefined, "   ");
    sizeGroup.add("statictext", undefined, "Height:");
    var defaultH = (17.104 / 2.83465 * unitToPt).toFixed(3);
    var heightInput = sizeGroup.add("edittext", undefined, defaultH);
    heightInput.characters = 6;
    sizeGroup.add("statictext", undefined, unitLabel);

    widthInput.onChanging = function () {
        var w = parseFloat(widthInput.text.replace(",", "."));
        if (!isNaN(w) && w > 0) {
            var pct = parseFloat(barHeightInput.text.replace(",", "."));
            if (isNaN(pct) || pct <= 0) pct = 76;
            var h = (w / baseWidth) * baseHeight * (pct / 76);
            heightInput.text = h.toFixed(3);
        }
    };
    heightInput.onChanging = function () {
        var h = parseFloat(heightInput.text.replace(",", "."));
        if (!isNaN(h) && h > 0) {
            var pct = parseFloat(barHeightInput.text.replace(",", "."));
            if (isNaN(pct) || pct <= 0) pct = 76;
            var w = h / (pct / 76) * (baseWidth / baseHeight);
            widthInput.text = w.toFixed(3);
        }
    };

    tab2.add("statictext", undefined, "Stroke height (% of bar-code height):");

    var barHeightGroup = tab2.add("group");
    barHeightGroup.orientation = "row";
    barHeightGroup.alignChildren = "center";
    barHeightGroup.add("statictext", undefined, "Percent:");
    var barHeightInput = barHeightGroup.add("edittext", undefined, "76");
    barHeightInput.characters = 4;
    barHeightGroup.add("statictext", undefined, "(76% = standard, long +10%)");
    barHeightGroup.margins = [0, 0, 0, 2];

    barHeightInput.onChanging = function () {
        var pct = parseFloat(barHeightInput.text.replace(",", "."));
        var w = parseFloat(widthInput.text.replace(",", "."));
        if (!isNaN(pct) && pct > 0 && pct <= 100 && !isNaN(w) && w > 0) {
            var h = (w / baseWidth) * baseHeight * (pct / 76);
            heightInput.text = h.toFixed(3);
        }
        forceRedraw();
    };

    var previewPanel2 = tab2.add("panel", undefined, "Preview:");
    previewPanel2.orientation = "column";
    previewPanel2.alignChildren = "center";
    previewPanel2.alignment = ["fill", "top"];
    previewPanel2.margins = 10;
    
    var previewCanvas2 = previewPanel2.add("group");
    previewCanvas2.preferredSize =[320, 110];
    
    previewCanvas2.onDraw = function() { drawSharedPreview(this); };

    var tab3 = tabs[2];
    tab3.alignChildren = "left";

    tab3.add("statictext", undefined, "Bar-code position:");

    var positionGroup = tab3.add("group");
    positionGroup.orientation = "row";
    positionGroup.alignChildren = "center";

    var centerCheckbox      = positionGroup.add("checkbox", undefined, "Centered");
    var bottomRightCheckbox = positionGroup.add("checkbox", undefined, "Bottom right");
    var customCheckbox      = positionGroup.add("checkbox", undefined, "Arbitrarily:");

    centerCheckbox.value      = true;
    bottomRightCheckbox.value = false;
    customCheckbox.value      = false;

    var customPosGroup = tab3.add("group");
    customPosGroup.orientation = "row";
    customPosGroup.alignChildren = "center";
    customPosGroup.enabled = false;

    customPosGroup.add("statictext", undefined, "X:");
    var customXInput = customPosGroup.add("edittext", undefined, "0");
    customXInput.characters = 7;
    customPosGroup.add("statictext", undefined, unitLabel);
    customPosGroup.add("statictext", undefined, "Y:");
    var customYInput = customPosGroup.add("edittext", undefined, "0");
    customYInput.characters = 7;
    customPosGroup.add("statictext", undefined, unitLabel);

    var optionsGroup = tab3.add("group");
    optionsGroup.orientation = "row";
    optionsGroup.alignChildren = "top";
    optionsGroup.spacing = 30;

    var originBlock = optionsGroup.add("group");
    originBlock.orientation = "column";
    originBlock.alignChildren = "center";

    var originLabel = originBlock.add("statictext", undefined, "Starting point:");
    originLabel.enabled = false;

    var originGridGroup = originBlock.add("group");
    originGridGroup.orientation = "row";
    originGridGroup.alignChildren = "center";
    originGridGroup.enabled = false;

    var gridPanel = originGridGroup.add("panel");
    gridPanel.orientation = "column";
    gridPanel.alignChildren = "left";
    gridPanel.margins = 4;

    var dotSize = [14, 14];
    var dots = {};

    var keys =[
        ["TL","TC","TR"],["ML","MC","MR"],["BL","BC","BR"]
    ];

    for (var r = 0; r < 3; r++) {
        var rowGroup = gridPanel.add("group");
        rowGroup.orientation = "row";
        rowGroup.spacing = 2;
        rowGroup.margins = 0;
        for (var c = 0; c < 3; c++) {
            var key = keys[r][c];
            var btn = rowGroup.add("button", undefined, "■");
            btn.size = dotSize;
            btn.key = key;
            dots[key] = btn;
        }
    }

    var selectedOrigin = "MC";

    function updateDotStyles() {
        for (var k in dots) {
            dots[k].text = (k === selectedOrigin) ? "X" : "";
        }
    }
    updateDotStyles();

    for (var r = 0; r < 3; r++) {
        for (var c = 0; c < 3; c++) {
            (function(key) {
                dots[key].onClick = function() {
                    selectedOrigin = key;
                    updateDotStyles();
                };
            })(keys[r][c]);
        }
    }

    var rotationBlock = optionsGroup.add("group");
    rotationBlock.orientation = "column";
    rotationBlock.alignChildren = "center";

    var rotationCheckbox = rotationBlock.add("checkbox", undefined, "Rotation");
    rotationCheckbox.enabled = false;

    var rotationInputGroup = rotationBlock.add("group");
    rotationInputGroup.orientation = "column";
    rotationInputGroup.alignChildren = "center";
    rotationInputGroup.enabled = false;

    var rotationInput = rotationInputGroup.add("edittext", undefined, "0");
    rotationInput.characters = 5;
    rotationInputGroup.add("statictext", undefined, "degrees");

    rotationCheckbox.onClick = function () {
        rotationInputGroup.enabled = rotationCheckbox.value;
    };

    function setCustomEnabled(val) {
        customPosGroup.enabled  = val;
        originLabel.enabled     = val;
        originGridGroup.enabled = val;
        rotationCheckbox.enabled = val;
        if (val) {
            rotationInputGroup.enabled = rotationCheckbox.value;
        } else {
            rotationInputGroup.enabled = false;
        }
    }

    centerCheckbox.onClick = function () {
        if (centerCheckbox.value) {
            bottomRightCheckbox.value = false;
            customCheckbox.value = false;
            setCustomEnabled(false);
        } else {
            bottomRightCheckbox.value = true;
        }
    };
    bottomRightCheckbox.onClick = function () {
        if (bottomRightCheckbox.value) {
            centerCheckbox.value = false;
            customCheckbox.value = false;
            setCustomEnabled(false);
        } else {
            centerCheckbox.value = true;
        }
    };
    customCheckbox.onClick = function () {
        if (customCheckbox.value) {
            centerCheckbox.value = false;
            bottomRightCheckbox.value = false;
            setCustomEnabled(true);
        } else {
            bottomRightCheckbox.value = true;
            setCustomEnabled(false);
        }
    };

    var buttonGroup = dialog.add("group");
    buttonGroup.alignment = "center";
    var okButton     = buttonGroup.add("button", undefined, "OK");
    var cancelButton = buttonGroup.add("button", undefined, "Cancel", {name: "cancel"});

    var result = null;

    okButton.onClick = function () {
        var input = inputField.text;
        if (!input.match(/^\d{12}$/)) {
            alert("Error: Please enter exactly 12 digits of the bar-code!");
            switchTab(0);
            return;
        }

        var width = parseFloat(widthInput.text.replace(",", "."));
        var height = parseFloat(heightInput.text.replace(",", "."));
        if (isNaN(width) || width <= 0 || isNaN(height) || height <= 0) {
            alert("Error: Please enter positive numeric values for width and height!");
            switchTab(1);
            return;
        }

        var barHeightPct = parseFloat(barHeightInput.text.replace(",", "."));
        if (isNaN(barHeightPct) || barHeightPct <= 0 || barHeightPct > 100) {
            alert("Error: Stroke height must be between 1 and 100%!");
            switchTab(1);
            return;
        }

        var doRot = rotationCheckbox.value && customCheckbox.value;
        var rotAngle = 0;
        if (doRot) {
            rotAngle = parseFloat(rotationInput.text.replace(",", "."));
            if (isNaN(rotAngle)) {
                alert("Error: Please specify a numeric value for the rotation angle!");
                switchTab(2);
                return;
            }
        }

        var posMode = "bottomRight";
        if (centerCheckbox.value) posMode = "center";
        else if (customCheckbox.value) posMode = "custom";

        var customX = 0, customY = 0;
        var originV = "center";
        var originH = "center";

        if (posMode === "custom") {
            customX = parseFloat(customXInput.text.replace(",", "."));
            customY = parseFloat(customYInput.text.replace(",", "."));
            if (isNaN(customX) || isNaN(customY)) {
                alert("Error: Please provide numeric values for X and Y!");
                switchTab(2);
                return;
            }
            var vChar = selectedOrigin.charAt(0);
            var hChar = selectedOrigin.charAt(1);
            if (vChar === "T")      originV = "top";
            else if (vChar === "B") originV = "bottom";
            else                    originV = "center";
            if (hChar === "L")      originH = "left";
            else if (hChar === "R") originH = "right";
            else                    originH = "center";
        }

        result = {
            input: input,
            width: width,
            height: height,
            quietZone: quietZoneCheckbox.value,
            whiteBg: whiteBgCheckbox.value,
            posMode: posMode,
            customX: customX,
            customY: customY,
            originV: originV,
            originH: originH,
            barHeightPercent: barHeightPct,
            doRotation: doRot,
            rotationAngle: rotAngle
        };

        dialog.close(1);
    };

    cancelButton.onClick = function () {
        dialog.close(0);
    };

    if (dialog.show() !== 1 || result === null) return;

    var input            = result.input;
    var targetWidth      = result.width;
    var targetHeight     = result.height;
    var addQuietZone     = result.quietZone;
    var addWhiteBg       = result.whiteBg;
    var posMode          = result.posMode;
    var customX          = result.customX;
    var customY          = result.customY;
    var originV          = result.originV;
    var originH          = result.originH;
    var barHeightPercent = result.barHeightPercent;

    var barcodeGroup = doc.groupItems.add();
    barcodeGroup.name = "Bar-code";

    var barsGroup = barcodeGroup.groupItems.add();
    barsGroup.name = "Strokes";

    var digitsGroup = barcodeGroup.groupItems.add();
    digitsGroup.name = "Digits";

    var full   = input + checksum(input);
    var code   = generateBarcodeBinary(full);

    var moduleWidth   = 0.94;
    var totalBase     = 60;
    var barHeight     = totalBase * (barHeightPercent / 100);
    var longBarHeight = barHeight + 6;
    var textHeight    = 9.5;
    var textBaseline  = -barHeight;
    var x             = 0;
    var barCounter    = 1;

    var black = new RGBColor();
    black.red = black.green = black.blue = 0;

    var i = 0;
    while (i < code.length) {
        if (code[i] === "1") {
            var isGuard = (i < 3 || (i >= 45 && i < 50) || i >= 92);
            var h = isGuard ? longBarHeight : barHeight;

            var widthCount = 1;
            while (i + 1 < code.length && code[i + 1] === "1") {
                var nextIdx = i + 1;
                var nextIsGuard = (nextIdx < 3 || (nextIdx >= 45 && nextIdx < 50) || nextIdx >= 92);
                if (nextIsGuard !== isGuard) break;
                widthCount++;
                i++;
            }

            var rectWidth = moduleWidth * widthCount;
            var rect = barsGroup.pathItems.rectangle(0, x, rectWidth, h);
            rect.filled    = true;
            rect.fillColor = black;
            rect.stroked   = false;
            rect.name      = String(barCounter++);
            x += rectWidth;
        } else {
            x += moduleWidth;
        }
        i++;
    }

    function addDigit(digit, posX, align) {
        var tf = digitsGroup.textFrames.add();
        tf.contents = digit;
        tf.textRange.characterAttributes.size = textHeight;
        try {
            tf.textRange.characterAttributes.textFont = app.textFonts.getByName("ocrb10");
        } catch (e) {
            tf.textRange.characterAttributes.textFont = app.textFonts.getByName("ArialMT");
        }
        tf.textRange.justification = align;
        tf.top = textBaseline;

        if (align == Justification.CENTER) {
            tf.left = posX - tf.width / 2;
        } else if (align == Justification.LEFT) {
            tf.left = posX;
        } else if (align == Justification.RIGHT) {
            tf.left = posX - tf.width;
        }

        var outlines = tf.createOutline();
        if (outlines.typename === "GroupItem") {
            for (var i = 0; i < outlines.pageItems.length; i++) {
                var item = outlines.pageItems[i];
                item.move(digitsGroup, ElementPlacement.PLACEATBEGINNING);
                item.name = digit;
            }
            outlines.remove();
        } else {
            outlines.name = digit;
        }
        try { if (tf.isValid) tf.remove(); } catch (e) {}
    }

    addDigit(full[0], -moduleWidth * 7, Justification.LEFT);
    for (var di = 1; di <= 6; di++) {
        var pos = moduleWidth * (3 + (di - 1) * 7);
        addDigit(full[di], pos + moduleWidth * 3.5, Justification.CENTER);
    }
    for (var di = 7; di <= 12; di++) {
        var pos = moduleWidth * (50 + (di - 7) * 7);
        addDigit(full[di], pos + moduleWidth * 3.5, Justification.CENTER);
    }

    if (addQuietZone) {
        var markerTf = digitsGroup.textFrames.add();
        markerTf.contents = ">";
        markerTf.textRange.characterAttributes.size = textHeight;
        try {
            markerTf.textRange.characterAttributes.textFont = app.textFonts.getByName("ocrb10");
        } catch (e) {
            markerTf.textRange.characterAttributes.textFont = app.textFonts.getByName("ArialMT");
        }
        markerTf.textRange.justification = Justification.LEFT;
        markerTf.top  = textBaseline;
        markerTf.left = moduleWidth * (50 + 6 * 7) + moduleWidth * 3.5;

        var markerOutline = markerTf.createOutline();
        if (markerOutline.typename === "GroupItem") {
            for (var i = 0; i < markerOutline.pageItems.length; i++) {
                var item = markerOutline.pageItems[i];
                item.move(digitsGroup, ElementPlacement.PLACEATBEGINNING);
                item.name = ">";
            }
            markerOutline.remove();
        } else {
            markerOutline.name = ">";
            markerOutline.move(digitsGroup, ElementPlacement.PLACEATBEGINNING);
        }
        try { if (markerTf.isValid) markerTf.remove(); } catch (e) {}
    }

    var bounds          = barcodeGroup.visibleBounds;
    var currentWidthPt  = bounds[2] - bounds[0];
    var currentHeightPt = bounds[1] - bounds[3];
    var targetWidthPt   = targetWidth  * unitToPt;
    var targetHeightPt  = targetHeight * unitToPt;
    var scaleX          = (targetWidthPt  / currentWidthPt)  * 100;
    var scaleY          = (targetHeightPt / currentHeightPt) * 100;
    barcodeGroup.resize(scaleX, scaleY);

    if (result.doRotation) {
        barcodeGroup.rotate(result.rotationAngle);
    }

    var abIndex  = doc.artboards.getActiveArtboardIndex();
    var abBounds = doc.artboards[abIndex].artboardRect; 

    var bc  = barcodeGroup.visibleBounds;
    var bcW = bc[2] - bc[0];
    var bcH = bc[1] - bc[3];

    if (posMode === "center") {
        var abCX = abBounds[0] + (abBounds[2] - abBounds[0]) / 2;
        var abCY = abBounds[1] + (abBounds[3] - abBounds[1]) / 2;
        barcodeGroup.position =[abCX - bcW / 2, abCY + bcH / 2];

    } else if (posMode === "bottomRight") {
        var marginPt = 2.83465;
        barcodeGroup.position =[
            abBounds[2] - marginPt - bcW,
            abBounds[3] + marginPt + bcH
        ];

    } else if (posMode === "custom") {
        var xPt = customX * unitToPt;
        var yPt = customY * unitToPt;

        var abLeft   = abBounds[0];
        var abTop    = abBounds[1];

        var posLeft, posTop;

        if (originH === "left") {
            posLeft = abLeft + xPt;
        } else if (originH === "right") {
            posLeft = abLeft + xPt - bcW;
        } else {
            posLeft = abLeft + xPt - bcW / 2;
        }

        if (originV === "top") {
            posTop = abTop - yPt;
        } else if (originV === "bottom") {
            posTop = abTop - yPt + bcH;
        } else {
            posTop = abTop - yPt + bcH / 2;
        }

        barcodeGroup.position =[posLeft, posTop];
    }

    if (addWhiteBg) {
        var bc2     = barcodeGroup.visibleBounds;
        var bcLeft  = bc2[0];
        var bcTop   = bc2[1];
        var bcRight = bc2[2];
        var bcBot   = bc2[3];
        var bcW2    = bcRight - bcLeft;
        var bcH2    = bcTop - bcBot;

        var pad = bcW2 * 0.05;
        var padR = bcW2 * 0.10;

        var white = new RGBColor();
        white.red = 255; white.green = 255; white.blue = 255;

        var bgRect = barcodeGroup.pathItems.rectangle(
            bcTop + pad,
            bcLeft - pad,
            bcW2 + pad + padR,
            bcH2 + pad * 2
        );
        bgRect.name      = "Background";
        bgRect.filled    = true;
        bgRect.fillColor = white;
        bgRect.stroked   = false;
        bgRect.move(barcodeGroup, ElementPlacement.PLACEATEND);
    }

    app.selection = null;
    barcodeGroup.selected = true;
    app.selection =[barcodeGroup];
}

main();
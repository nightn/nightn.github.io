/**
 * geo2svg.js
 * author: nightn
 * description: convert geojson to svg string or svg element given size, padding, style etc.
 * the Geojson object can be one of the nine objects which are defined in RFC7946:
 *   Point, LineString, Polygon, MultiPoint, MultiLineString, MultiPolygon,
 *   GeometryCollection, Feature, FeatureCollection
 */

(function () {
    var defaultOption = {
        size: [256, 256],                // size[0] is svg width, size[1] is svg height
        padding: [0, 0, 0, 0],           // paddintTop, paddintRight, paddingBottom, paddingLeft, respectively
        output: 'string',                // output type: 'string'|'element'
        precision: 3,                    // svg coordinates precision
        stroke: 'red',                   // stroke color
        strokeWidth: '1px',              // stroke width
        background: '#fff',              // svg background color, and as the fill color of polygon hole
        fill: '#fff',                    // fill color
        fillOpacity: 1                   // fill opacity
    };

    var converter = {};

    converter.convertPolygon = function (geojson, option) {
        var svgWidth = option.size[0];
        var svgHeight = option.size[1];
        var paddingTop = option.padding[0];
        var paddingRight = option.padding[1];
        var paddingBottom = option.padding[2];
        var paddingLeft = option.padding[3];
        var geometryWidth = svgWidth - paddingLeft - paddingRight;
        var geometryHeight = svgHeight - paddingTop - paddingBottom;
        var precision = option.precision;
        var coords = geojson.coordinates;
        var outerCoords = coords[0];  // outer polygon coordinates
        var innerPolygons = coords.slice(1, coords.length);  // inner polygon array

        // find max extent
        var westSouth = [Infinity, Infinity];
        var eastNorth = [-Infinity, -Infinity];
        for (var i = 0; i < outerCoords.length; i++) {
            var point = outerCoords[i];
            if (point[0] < westSouth[0]) {
                westSouth[0] = point[0];
            }
            if (point[1] < westSouth[1]) {
                westSouth[1] = point[1];
            }
            if (point[0] > eastNorth[0]) {
                eastNorth[0] = point[0];
            }
            if (point[1] > eastNorth[1]) {
                eastNorth[1] = point[1];
            }
        }

        var paths = [];

        var outerPath = polygonToSvgPath(outerCoords, westSouth, eastNorth, geometryWidth, geometryHeight, option.padding, precision);
        outerPath = stylePath(outerPath, option.fill, option.fillOpacity, option.stroke, option.strokeWidth);
        paths.push(outerPath);

        // deal with poles in the polygon
        for (var i = 0; i < innerPolygons.length; i++) {
            var path = polygonToSvgPath(innerPolygons[i], westSouth, eastNorth, geometryWidth, geometryHeight, option.padding, precision);
            path = stylePath(path, option.background, 1, option.stroke, option.strokeWidth);
            paths.push(path);
        }
        
        var fullSvgStr = '<svg xmlns="http://www.w3.org/2000/svg" style="background:' + option.background + '" width="' + svgWidth + '" height="' + svgHeight + '" >'
        fullSvgStr += paths.join('');
        fullSvgStr += '</svg>';

        return fullSvgStr;
    }

    function stylePath(pathStr, fill, fillOpacity, stroke, strokeWidth) {
        var styles = [];
        styles.push(' fill="' + fill + '"');
        styles.push(' fill-opacity="' + fillOpacity + '"');
        styles.push(' stroke="' + stroke + '"');
        styles.push(' stroke-width="' + strokeWidth + '"');
        return (pathStr.split('/>')[0] + styles.join('') + '/>');
    }

    // TODO converter.convertMultiPolygon

    // TODO support more geometries
    converter.convertFeature = function (geojson, option) {
        return converter.convertPolygon(geojson.geometry, option);
    }

    // TODO support more geometries
    converter.convertFeatureCollection = function (geojson, option) {
        return converter.convertFeature(geojson.features[0], option);
    }

    var geo2svg = function (geojson, option) {
        var funcName = 'convert' + geojson.type;
        if (!converter[funcName]) {
            throw new Error('The type of input object is not supported.');
        }
        // init option
        option = option || {};
        for (var key in defaultOption) {
            option[key] = option[key] || defaultOption[key];
        }
        var svg = converter[funcName](geojson, option);
        if (option.output == 'element') {
            svg = parseSVG(svg);
        }
        return svg;
    }

    // convert polygon points to svg path (for both of outer polygon and inner polygon)
    function polygonToSvgPath(points, westSouth, eastNorth, geometryWidth, geometryHeight, padding, precision) {
        // calcu resolution
        var xRes = (eastNorth[0] - westSouth[0]) / geometryWidth;  // x resolution
        var yRes = (eastNorth[1] - westSouth[1]) / geometryHeight; // y resolution
        var resolution = (xRes > yRes ? xRes : yRes);              // max resolution
        
        // map wgs84 point to svg point
        var origin = westSouth;
        var svgStr = [];
        var paddingLeft = padding[3];
        var paddingTop = padding[0];
        for (var i = 0; i < points.length; i++) {
            var pt = points[i];
            var x = (pt[0] - origin[0]) / resolution + paddingLeft;
            // y direction of svg coord system is different from geojson's 
            var y = geometryHeight - (pt[1] - origin[1]) / resolution + paddingTop;
            x = x.toFixed(precision);
            y = y.toFixed(precision);

            // adjust shape in the middle of svg element
            if (xRes > yRes) {
                var dy = (geometryHeight - (eastNorth[1] - westSouth[1]) / resolution) / 2;
                y = (+y - dy).toFixed(precision);
            } else {
                var dx = (geometryWidth - (eastNorth[0] - westSouth[0]) / resolution) / 2;
                x = (+x + dx).toFixed(precision);
            }

            var cmd = (i === 0 ? 'M' : 'L');
            var pStr = cmd + x + ' ' + y;
            svgStr.push(pStr);
        }
        // the value of d property of path
        svgStr = svgStr.join(',');
        svgStr = '<path d="' + svgStr + '" />';
        return svgStr;
    }


    // parse svg string to svg element
    function parseSVG(s) {
        var div = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
        div.innerHTML = s;
        var frag = document.createDocumentFragment();
        while (div.firstChild)
            frag.appendChild(div.firstChild);
        return frag;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = geo2svg;
    }

    if (typeof window !== 'undefined') {
        window.geo2svg = geo2svg;
    }
})();

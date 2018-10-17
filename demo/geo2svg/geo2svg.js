'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

/**
 * geo2svg.js
 * author: nightn
 * description: convert geojson to svg string or svg element given size, padding, style etc.
 * the Geojson object can be any one of the nine objects which are defined in RFC7946:
 *   Point, LineString, Polygon, MultiPoint, MultiLineString, MultiPolygon,
 *   GeometryCollection, Feature, FeatureCollection
 */

(function () {

    var defaultOption = {
        size: [256, 256], // size[0] is svg width, size[1] is svg height
        padding: [0, 0, 0, 0], // paddintTop, paddintRight, paddingBottom, paddingLeft, respectively
        output: 'string', // output type: 'string'|'element'
        precision: 3, // svg coordinates precision
        stroke: 'red', // stroke color
        strokeWidth: '1px', // stroke width
        background: '#fff', // svg background color, and as the fill color of polygon hole
        fill: '#fff', // fill color
        fillOpacity: 1, // fill opacity
        radius: 5 // only for `Point`, `MultiPoint`
    };

    var svg = {};

    svg.style = function (svgStr, option) {
        var fill = option.fill;
        var fillOpacity = option.fillOpacity;
        var stroke = option.stroke;
        var strokeWidth = option.strokeWidth;

        var styles = [svgStr.split('/>')[0]];
        styles.push('fill="' + fill + '"');
        styles.push('fill-opacity="' + fillOpacity + '"');
        styles.push('stroke="' + stroke + '"');
        styles.push('stroke-width="' + strokeWidth + '"');
        return styles.join(' ') + ' />';
    };

    svg.createCircle = function (point, option) {
        var _point = _slicedToArray(point, 2);

        var x = _point[0];
        var y = _point[1];
        var radius = option.radius;
        var precision = option.precision;

        var svgStr = '<circle cx="' + x.toFixed(precision) + '" cy="' + y.toFixed(precision) + '" r="' + radius.toFixed(precision) + '" />';
        return svg.style(svgStr, option);
    };

    svg.createPath = function (points, option) {
        var p = option.precision;
        // firefox cannot use common as splitor, so use space
        var pathd = points.map(function (pt, index) {
            return '' + (index === 0 ? 'M' : 'L') + pt[0].toFixed(p) + ' ' + pt[1].toFixed(p);
        }).join(' ');
        var svgStr = '<path d="' + pathd + '" />';
        return svg.style(svgStr, option);
    };

    // parse svg string to svg element
    svg.parseSVG = function (s) {
        var div = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
        div.innerHTML = s;
        var frag = document.createDocumentFragment();
        while (div.firstChild) {
            frag.appendChild(div.firstChild);
        }return frag;
    };

    function getExtent(points) {
        var extent = [Infinity, Infinity, -Infinity, -Infinity];
        points.forEach(function (pt) {
            var _pt = _slicedToArray(pt, 2);

            var x = _pt[0];
            var y = _pt[1];

            if (x < extent[0]) extent[0] = x;
            if (x > extent[2]) extent[2] = x;
            if (y < extent[1]) extent[1] = y;
            if (y > extent[3]) extent[3] = y;
        });
        return extent;
    }

    // get all points from geojson object
    function getAllPoints(geojson) {
        // get all points from geojson object
        switch (geojson.type) {
            case 'Point':
                {
                    return [geojson.coordinates];
                }
            case 'MultiPoint':
            case 'LineString':
                {
                    return geojson.coordinates;
                    break;
                }
            case 'MultiLineString':
            case 'Polygon':
                {
                    var pointsArr = geojson.coordinates;
                    return pointsArr.reduce(function (prev, item) {
                        return prev.concat(item);
                    }, pointsArr[0]);
                }
            case 'MultiPolygon':
                {
                    var multiArr = geojson.coordinates;
                    var arr = multiArr.reduce(function (prev, item) {
                        return prev.concat(item);
                    }, multiArr[0]);
                    return arr.reduce(function (prev, item) {
                        return prev.concat(item);
                    }, arr[0]);
                }
            case 'GeometryCollection':
                {
                    var geometries = geojson.geometries;
                    var _pointsArr = geometries.map(function (geom) {
                        return getAllPoints(geom);
                    });
                    return _pointsArr.reduce(function (prev, item) {
                        return prev.concat(item);
                    }, _pointsArr[0]);
                }
            case 'Feature':
                {
                    return getAllPoints(geojson.geometry);
                }
            case 'FeatureCollection':
                {
                    var features = geojson.features;
                    var _pointsArr2 = features.map(function (feature) {
                        return getAllPoints(feature);
                    });
                    return _pointsArr2.reduce(function (prev, item) {
                        return prev.concat(item);
                    }, _pointsArr2[0]);
                }
        }
    }

    function geoPointToPixelPoint(pt, geometrySize, xRes, yRes, res, extent, origin, padding) {
        var paddingLeft = padding[3];
        var paddingTop = padding[0];

        var _geometrySize = _slicedToArray(geometrySize, 2);

        var geometryWidth = _geometrySize[0];
        var geometryHeight = _geometrySize[1];

        var x = (pt[0] - origin[0]) / res + paddingLeft;
        // y direction of svg coord system is different from geojson's 
        var y = geometryHeight - (pt[1] - origin[1]) / res + paddingTop;
        // adjust shape in the middle of svg element
        if (xRes > yRes) {
            var dy = (geometryHeight - (extent[3] - extent[1]) / res) / 2;
            y = y - dy;
        } else {
            var dx = (geometryWidth - (extent[2] - extent[0]) / res) / 2;
            x = x + dx;
        }
        return [x, y];
    }

    // converter
    var converter = {};
    /**
     * 
     * @param {Array[]} points 
     * @param {string} basicGeometryType 取值 'Point' | 'LineString' | 'Polygon'
     * @param {Object} option
     * @return {string}
     */
    converter.convertBasicGeometry = function (points, basicGeometryType, option) {
        switch (basicGeometryType) {
            case 'Point':
                {
                    return svg.createCircle(points[0], option);
                }
            case 'LineString':
                {
                    return svg.createPath(points, option);
                }
            case 'Polygon':
                {
                    return svg.createPath(points, option);
                }
        }
    };

    converter.getCommonOpt = function (geojson, option) {
        var _option$size = _slicedToArray(option.size, 2);

        var svgWidth = _option$size[0];
        var svgHeight = _option$size[1];

        var _option$padding = _slicedToArray(option.padding, 4);

        var paddingTop = _option$padding[0];
        var paddingRight = _option$padding[1];
        var paddingBottom = _option$padding[2];
        var paddingLeft = _option$padding[3];

        var geometryWidth = svgWidth - paddingLeft - paddingRight;
        var geometryHeight = svgHeight - paddingTop - paddingBottom;
        // get the extent
        var extent = getExtent(getAllPoints(geojson));
        // calculate resolution
        var xRes = (extent[2] - extent[0]) / geometryWidth; // x resolution
        var yRes = (extent[3] - extent[1]) / geometryHeight; // y resolution
        var res = xRes > yRes ? xRes : yRes; // max resolution

        var commonOpt = {
            xRes: xRes,
            yRes: yRes,
            res: res,
            extent: extent,
            origin: [extent[0], extent[1]],
            geometrySize: [geometryWidth, geometryHeight]
        };
        return commonOpt;
    };

    converter.convertPoint = function (geojson, option, commonOpt) {
        var xRes = commonOpt.xRes;
        var yRes = commonOpt.yRes;
        var res = commonOpt.res;
        var extent = commonOpt.extent;
        var origin = commonOpt.origin;
        var geometrySize = commonOpt.geometrySize;

        var center = geoPointToPixelPoint(geojson.coordinates, geometrySize, xRes, yRes, res, extent, origin, option.padding);
        return svg.createCircle(center, option);
    };

    converter.convertMultiPoint = function (geojson, option, commonOpt) {
        var xRes = commonOpt.xRes;
        var yRes = commonOpt.yRes;
        var res = commonOpt.res;
        var extent = commonOpt.extent;
        var origin = commonOpt.origin;
        var geometrySize = commonOpt.geometrySize;
        // callers are supposed to set reasonable padding themselves.
        // option.padding = option.padding.map(item => item + radius);  // comment it

        var svgStr = geojson.coordinates
        // map geographical point to pixel point
        .map(function (pt) {
            return geoPointToPixelPoint(pt, geometrySize, xRes, yRes, res, extent, origin, option.padding);
        })
        // map pixel point to svg string
        .map(function (pt) {
            return svg.createCircle(pt, option);
        }).join('');
        return svgStr;
    };

    converter.convertLineString = function (geojson, option, commonOpt) {
        var xRes = commonOpt.xRes;
        var yRes = commonOpt.yRes;
        var res = commonOpt.res;
        var extent = commonOpt.extent;
        var origin = commonOpt.origin;
        var geometrySize = commonOpt.geometrySize;

        var coords = Array.isArray(geojson) ? geojson : geojson.coordinates;
        var pixelPoints = coords.map(function (pt) {
            return geoPointToPixelPoint(pt, geometrySize, xRes, yRes, res, extent, origin, option.padding);
        });
        // [Important] change linestring fill opacity, using a copy of option
        var optionForLineString = {};
        Object.assign(optionForLineString, option);
        optionForLineString.fillOpacity = 0;
        return svg.createPath(pixelPoints, optionForLineString);
    };

    converter.convertMultiLineString = function (geojson, option, commonOpt) {
        return geojson.coordinates.map(function (points) {
            return converter.convertLineString(points, option, commonOpt);
        }).join('');
    };

    converter.convertPolygon = function (geojson, option, commonOpt) {
        var xRes = commonOpt.xRes;
        var yRes = commonOpt.yRes;
        var res = commonOpt.res;
        var extent = commonOpt.extent;
        var origin = commonOpt.origin;
        var geometrySize = commonOpt.geometrySize;

        var coords = Array.isArray(geojson) ? geojson : geojson.coordinates;

        // option for inner polygon
        var optionForInner = {};
        Object.assign(optionForInner, option);
        optionForInner.fill = option.background;
        optionForInner.fillOpacity = 1;

        return coords.map(function (points, index) {
            var pixelPoints = points.map(function (pt) {
                return geoPointToPixelPoint(pt, geometrySize, xRes, yRes, res, extent, origin, option.padding);
            });
            // the first polygon is outer polygon
            if (index == 0 || Array.isArray(geojson)) {
                return svg.createPath(pixelPoints, option);
            }
            // the others are inner polygon, so change their fill style
            return svg.createPath(pixelPoints, optionForInner);
        }).join('');
    };

    converter.convertMultiPolygon = function (geojson, option, commonOpt) {
        return geojson.coordinates.map(function (points, index) {
            return converter.convertPolygon(points, option, commonOpt);
        }).join('');
    };

    converter.convertGeometryCollection = function (geojson, option, commonOpt) {
        var geoms = geojson.geometries;
        return geoms.map(function (geom) {
            var funcName = 'convert' + geom.type;
            return converter[funcName](geom, option, commonOpt);
        }).join('');
    };

    converter.convertFeature = function (geojson, option, commonOpt) {
        var geom = geojson.geometry;
        var funcName = 'convert' + geom.type;
        return converter[funcName](geom, option, commonOpt);
    };

    converter.convertFeatureCollection = function (geojson, option, commonOpt) {
        var features = geojson.features;
        return features.map(function (feature) {
            return converter.convertFeature(feature, option, commonOpt);
        }).join('');
    };

    var geo2svg = function geo2svg(geojson, option) {
        var type = geojson.type;
        var funcName = 'convert' + type;
        if (!converter[funcName]) {
            throw new Error('The type of input object is not supported.');
        }
        var commonOpt = converter.getCommonOpt(geojson, option);
        // init option
        option = option || {};
        for (var key in defaultOption) {
            option[key] = option[key] || defaultOption[key];
        }
        var fullSvgStr = '<svg xmlns="http://www.w3.org/2000/svg" style="background:' + option.background + '" width="' + option.size[0] + '" height="' + option.size[1] + '" >';
        var convert = converter[funcName];

        // handle one point
        // TODO more complicated situation
        if (type === 'Point' || type === 'GeometryCollection' && geojson.geometries.length === 1 && geojson.geometries[0].type === 'Point' || type === 'FeatureCollection' && geojson.features.length === 1 && geojson.features[0].geometry.type === 'Point') {
            convert = function convert(geojson, option, commonOpt) {
                var xRes = commonOpt.xRes;
                var yRes = commonOpt.yRes;
                var res = commonOpt.res;
                var extent = commonOpt.extent;
                var origin = commonOpt.origin;
                var geometrySize = commonOpt.geometrySize;

                var _option$padding2 = _slicedToArray(option.padding, 4);

                var paddingTop = _option$padding2[0];
                var paddingRight = _option$padding2[1];
                var paddingBottom = _option$padding2[2];
                var paddingLeft = _option$padding2[3];

                var center = [paddingLeft + geometrySize[0] / 2, paddingTop + geometrySize[1] / 2];
                return svg.createCircle(center, option);
            };
        }

        var svgContent = convert(geojson, option, commonOpt);
        fullSvgStr += svgContent;
        fullSvgStr += '</svg>';
        var fullSvg = fullSvgStr;
        if (option.output == 'element') {
            fullSvg = svg.parseSVG(fullSvgStr);
        }
        return fullSvg;
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = geo2svg;
    }

    if (typeof window !== 'undefined') {
        window.geo2svg = geo2svg;
    }
})();

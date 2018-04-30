(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define(['exports', 'd3-selection', 'd3-scale', 'd3-array', 'd3-transition', 'd3-tip', 'd3-hierarchy'], factory);
  } else if (typeof exports !== "undefined") {
    factory(exports, require('d3-selection'), require('d3-scale'), require('d3-array'), require('d3-transition'), require('d3-tip'), require('d3-hierarchy'));
  } else {
    var mod = {
      exports: {}
    };
    factory(mod.exports, global.d3Selection, global.d3Scale, global.d3Array, global.d3Transition, global.d3Tip, global.d3Hierarchy);
    global.d3FlameGraph = mod.exports;
  }
})(this, function (exports, _d3Selection, _d3Scale, _d3Array, _d3Transition, _d3Tip, _d3Hierarchy) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });

  var _d3Tip2 = _interopRequireDefault(_d3Tip);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  var _createClass = function () {
    function defineProperties(target, props) {
      for (var i = 0; i < props.length; i++) {
        var descriptor = props[i];
        descriptor.enumerable = descriptor.enumerable || false;
        descriptor.configurable = true;
        if ("value" in descriptor) descriptor.writable = true;
        Object.defineProperty(target, descriptor.key, descriptor);
      }
    }

    return function (Constructor, protoProps, staticProps) {
      if (protoProps) defineProperties(Constructor.prototype, protoProps);
      if (staticProps) defineProperties(Constructor, staticProps);
      return Constructor;
    };
  }();

  var indexOf = [].indexOf || function (item) {
    for (var i = 0, l = this.length; i < l; i++) {
      if (i in this && this[i] === item) return i;
    }
    return -1;
  };

  var getClassAndMethodName = function getClassAndMethodName(fqdn) {
    var tokens = void 0;
    if (!fqdn) {
      return "";
    }
    tokens = fqdn.split(".");
    return tokens.slice(tokens.length - 2).join(".");
  };

  // Return a vector (0.0 -> 1.0) that is a hash of the input string.
  // The hash is computed to favor early characters over later ones, so
  // that strings with similar starts have similar vectors. Only the first
  // 6 characters are considered.
  var hash = function hash(name) {
    var i = void 0,
        j = void 0,
        maxHash = void 0,
        mod = void 0,
        ref = void 0,
        ref1 = void 0,
        result = void 0,
        weight = void 0;
    ref = [0, 0, 1, 10], result = ref[0], maxHash = ref[1], weight = ref[2], mod = ref[3];
    name = getClassAndMethodName(name).slice(0, 6);
    for (i = j = 0, ref1 = name.length - 1; 0 <= ref1 ? j <= ref1 : j >= ref1; i = 0 <= ref1 ? ++j : --j) {
      result += weight * (name.charCodeAt(i) % mod);
      maxHash += weight * (mod - 1);
      weight *= 0.7;
    }
    if (maxHash > 0) {
      return result / maxHash;
    } else {
      return result;
    }
  };

  var FlameGraphUtils = {
    augment: function augment(node, location) {
      var children = node.children;
      // d3.partition adds the reverse (depth), here we store the distance
      // between a node and its furthest leaf
      if (node.augmented) {
        return node;
      }
      node.originalValue = node.value;
      node.level = node.children ? 1 : 0;
      node.hidden = [];
      node.location = location;
      if (!(children != null ? children.length : void 0)) {
        node.augmented = true;
        return node;
      }
      var childSum = children.reduce(function (sum, child) {
        return sum + child.value;
      }, 0);
      if (childSum < node.value) {
        children.push({
          value: node.value - childSum,
          filler: true
        });
      }
      children.forEach(function (child, idx) {
        return FlameGraphUtils.augment(child, location + "." + idx);
      });
      node.level += children.reduce(function (max, child) {
        return Math.max(child.level, max);
      }, 0);
      node.augmented = true;
      return node;
    },
    partition: function partition(data) {
      var d3partition = (0, _d3Hierarchy.partition)();

      var root = (0, _d3Hierarchy.hierarchy)(data).sum(function (d) {
        return d.data ? d.data.value : d.value;
      }).sort(function (a, b) {
        if (a.filler || a.data.filler) {
          return 1; // move fillers to the right
        }
        if (b.filler || a.data.filler) {
          return -1; // move fillers to the right
        }
        return a.data.name.localeCompare(b.data.name);
      });
      return d3partition(root).descendants();
    },
    hide: function hide(nodes, unhide) {
      if (unhide === null) {
        unhide = false;
      }
      var sum = function sum(arr) {
        return arr.reduce(function (acc, val) {
          return acc + val;
        }, 0);
      };
      var remove = function remove(arr, val) {
        // we need to remove precisely one occurrence of initial value
        var pos = arr.indexOf(val);
        if (pos >= 0) {
          return arr.splice(pos, 1);
        }
      };
      var process = function process(node, val) {
        if (unhide) {
          remove(node.hidden, val);
        } else {
          node.hidden.push(val);
        }
        return node.value = Math.max(node.originalValue - sum(node.hidden), 0);
      };
      var processChildren = function processChildren(node, val) {
        if (!node.children) {
          return;
        }
        return node.children.forEach(function (child) {
          process(child, val);
          return processChildren(child, val);
        });
      };
      var processParents = function processParents(node, val) {
        var results = [];
        while (node.parent) {
          process(node.parent, val);
          results.push(node = node.parent);
        }
        return results;
      };
      return nodes.forEach(function (node) {
        var val = node.originalValue;
        processParents(node, val);
        process(node, val);
        return processChildren(node, val);
      });
    }
  };

  var FlameGraph = function () {
    function FlameGraph(selector, root, debug) {
      _classCallCheck(this, FlameGraph);

      this._selector = selector;
      this._generateAccessors(['margin', 'cellHeight', 'zoomEnabled', 'zoomAction', 'tooltip', 'tooltipPlugin', 'color', 'labelFunction']);
      this._ancestors = [];
      if (debug == null) {
        debug = false;
      }

      // enable logging only if explicitly specified
      if (debug) {
        this.console = window.console;
      } else {
        this.console = {
          log: function log() {},
          time: function time() {},
          timeEnd: function timeEnd() {}
        };
      }

      // defaults
      this._size = [1200, 800];
      this._cellHeight = 20;
      this._margin = {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
      };
      this._color = function (d) {
        var val = hash(d.data ? d.data.name : d.name);
        var r = 200 + Math.round(55 * val);
        var g = 0 + Math.round(230 * (1 - val));
        var b = 0 + Math.round(55 * (1 - val));
        return "rgb(" + r + ", " + g + ", " + b + ")";
      };
      this._labelFunction = null;
      this._tooltipEnabled = true;
      this._zoomEnabled = true;
      if (this._tooltipEnabled && _d3Tip2.default) {
        this._tooltipPlugin = (0, _d3Tip2.default)();
      }

      // initial processing of data
      this.console.time('augment');
      this.original = FlameGraphUtils.augment(root, '0');
      this.console.timeEnd('augment');
      this.root(this.original);
    }

    _createClass(FlameGraph, [{
      key: 'size',
      value: function size(_size) {
        if (_size) {
          this._size = _size;
          (0, _d3Selection.select)(this._selector).select('.flame-graph').attr('width', this._size[0]).attr('height', this._size[1]);
          return this;
        }
        return this._size;
      }
    }, {
      key: 'root',
      value: function root(_root) {
        if (!_root) {
          return this._root;
        }
        this.console.time('partition');
        this._root = _root;
        this._data = FlameGraphUtils.partition(this._root);
        this._rootNode = this._data[0];
        this.console.timeEnd('partition');
        return this;
      }
    }, {
      key: 'hide',
      value: function hide(predicate, unhide) {
        var matches = void 0;
        if (unhide == null) {
          unhide = false;
        }
        matches = this.select(predicate, false);
        if (!matches.length) {
          return;
        }
        FlameGraphUtils.hide(matches, unhide);
        this._data = FlameGraphUtils.partition(this._root);
        return this.render();
      }
    }, {
      key: 'zoom',
      value: function zoom(node, event) {
        if (!this.zoomEnabled()) {
          throw new Error("Zoom is disabled!");
        }
        if (this.tip) {
          this.tip.hide();
        }
        if (indexOf.call(this._ancestors, node) >= 0) {
          this._ancestors = this._ancestors.slice(0, this._ancestors.indexOf(node));
        } else {
          this._ancestors.push(this._root);
        }
        this.root(node.data ? node.data : node).render();
        if (typeof this._zoomAction === "function") {
          this._zoomAction(node, event);
        }
        return this;
      }
    }, {
      key: 'width',
      value: function width() {
        return this.size()[0] - (this.margin().left + this.margin().right);
      }
    }, {
      key: 'height',
      value: function height() {
        return this.size()[1] - (this.margin().top + this.margin().bottom);
      }
    }, {
      key: 'label',
      value: function label(d) {
        if (!(d != null ? d.data.name : void 0)) {
          return "";
        }
        var label = typeof this._labelFunction === "function" ? this._labelFunction(d) : getClassAndMethodName(d.data.name);

        return label.substr(0, Math.round(this.x(d.x1 - d.x0) / (this.cellHeight() / 10 * 4)));
      }
    }, {
      key: 'select',
      value: function select(predicate, onlyVisible) {
        var result = void 0;
        if (onlyVisible == null) {
          onlyVisible = true;
        }
        if (onlyVisible) {
          return this.container.selectAll('.node').filter(predicate);
        } else {
          // re-partition the data prior to rendering
          result = FlameGraphUtils.partition(this.original).filter(predicate);
          return result;
        }
      }
    }, {
      key: 'render',
      value: function render() {
        if (!this._selector) {
          throw new Error("No DOM element provided");
        }
        this.console.time('render');
        if (!this.container) {
          this._createContainer();
        }

        // reset size and scales
        this.fontSize = this.cellHeight() / 10 * 0.4;

        this.x = (0, _d3Scale.scaleLinear)().domain([0, (0, _d3Array.max)(this._data, function (d) {
          return d.x1;
        })]).range([0, this.width()]);

        var visibleCells = Math.floor(this.height() / this.cellHeight());
        var maxLevels = this._root.level;

        this.y = (0, _d3Scale.scaleQuantize)().domain([(0, _d3Array.min)(this._data, function (d) {
          return d.y0;
        }), (0, _d3Array.max)(this._data, function (d) {
          return d.y0;
        })]).range((0, _d3Array.range)(maxLevels).map(function (_this) {
          return function (cell) {
            return (visibleCells - 1 - cell - _this._ancestors.length) * _this.cellHeight();
          };
        }(this)));

        // JOIN
        var data = this._data.filter(function (_this) {
          return function (d) {
            return _this.x(d.x1 - d.x0) > 0.4 && _this.y(d.y0) >= 0 && !d.data.filler;
          };
        }(this));
        var renderNode = {
          x: function (_this) {
            return function (d) {
              return _this.x(d.x0);
            };
          }(this),
          y: function (_this) {
            return function (d) {
              return _this.y(d.y0);
            };
          }(this),
          width: function (_this) {
            return function (d) {
              var res = _this.x(d.x1 - d.x0);
              return res;
            };
          }(this),
          height: function (_this) {
            return function (d) {
              return _this.cellHeight();
            };
          }(this),
          text: function (_this) {
            return function (d) {
              if (d.data.name && _this.x(d.x1 - d.x0) > 40) {
                return _this.label(d);
              }
            };
          }(this)
        };
        var existingContainers = this.container.selectAll('.node').data(data, function (d) {
          return d.data.location;
        }).attr('class', 'node');

        // UPDATE
        this._renderNodes(existingContainers, renderNode, false, data);

        // ENTER
        var newContainers = existingContainers.enter().append('g').attr('class', 'node');
        this._renderNodes(newContainers, renderNode, true, data);

        // EXIT
        existingContainers.exit().remove();
        if (this.zoomEnabled()) {
          this._renderAncestors()._enableNavigation();
        }
        if (this.tooltip()) {
          this._renderTooltip();
        }
        this.console.timeEnd('render');
        this.console.log('Processed ' + this._data.length + ' items');
        return this;
      }
    }, {
      key: '_createContainer',
      value: function _createContainer() {
        // remove any previously existing svg
        (0, _d3Selection.select)(this._selector).select('svg').remove();
        // create main svg container
        var svg = (0, _d3Selection.select)(this._selector).append('svg').attr('class', 'flame-graph').attr('width', this._size[0]).attr('height', this._size[1]);
        // we set an offset based on the margin
        var offset = 'translate(' + this.margin().left + ', ' + this.margin().top + ')';
        // this.container will hold all our nodes
        this.container = svg.append('g').attr('transform', offset);

        // this rectangle draws the border around the flame graph
        // has to be appended after the container so that the border is visible
        // we also need to apply the same translation
        return svg.append('rect').attr('width', this._size[0] - (this._margin.left + this._margin.right)).attr('height', this._size[1] - (this._margin.top + this._margin.bottom)).attr('transform', offset).attr('class', 'border-rect');
      }
    }, {
      key: '_renderNodes',
      value: function _renderNodes(containers, attrs, enter, data) {
        var targetLabels = void 0;
        var targetRects = void 0;
        if (enter == null) {
          enter = false;
        }
        if (!enter) {
          targetRects = containers.selectAll('rect');
        }
        if (enter) {
          targetRects = containers.append('rect');
        }

        targetRects.data(data, function (d) {
          return d.data ? d.data.location : d.location;
        }).attr('fill', function (_this) {
          return function (d) {
            return _this._color(d);
          };
        }(this)).transition().attr('width', attrs.width).attr('height', this.cellHeight()).attr('x', attrs.x).attr('y', attrs.y);

        if (!enter) {
          targetLabels = containers.selectAll('text');
        }
        if (enter) {
          targetLabels = containers.append('text');
        }
        targetLabels.data(data, function (d) {
          return d.data ? d.data.location : d.location;
        }).attr('class', 'label').style('font-size', this.fontSize + "em").transition().attr('dy', this.fontSize / 2 + "em").attr('x', function (_this) {
          return function (d) {
            return attrs.x(d) + 2;
          };
        }(this)).attr('y', function (_this) {
          return function (d, idx) {
            return attrs.y(d, idx) + _this.cellHeight() / 2;
          };
        }(this)).text(attrs.text);
        return this;
      }
    }, {
      key: '_renderTooltip',
      value: function _renderTooltip() {
        if (!this._tooltipPlugin || !this._tooltipEnabled) {
          return this;
        }
        this.tip = this._tooltipPlugin.attr('class', 'd3-tip').html(this.tooltip()).direction(function (_this) {
          return function (d) {
            if (_this.x(d.x0) + _this.x(d.x1 - d.x0) / 2 > _this.width() - 100) {
              return 'w';
            }
            if (_this.x(d.x0) + _this.x(d.x1 - d.x0) / 2 < 100) {
              return 'e';
            }
            return 's';
          };
        }(this)).offset(function (_this) {
          return function (d) {
            var x = _this.x(d.x0) + _this.x(d.x1 - d.x0) / 2;
            var xOffset = Math.max(Math.ceil(_this.x(d.x1 - d.x0) / 2), 5);
            var yOffset = Math.ceil(_this.cellHeight() / 2);
            if (_this.width() - 100 < x) {
              return [0, -xOffset];
            }
            if (x < 100) {
              return [0, xOffset];
            }
            return [yOffset, 0];
          };
        }(this));
        this.container.call(this.tip);
        this.container.selectAll('.node').on('mouseover', function (_this) {
          return function (d) {
            return _this.tip.show(d, _d3Selection.event.currentTarget);
          };
        }(this)).on('mouseout', this.tip.hide).selectAll('.label').on('mouseover', function (_this) {
          return function (d) {
            return _this.tip.show(d, _d3Selection.event.currentTarget.parentNode);
          };
        }(this)).on('mouseout', this.tip.hide);
        return this;
      }
    }, {
      key: '_renderAncestors',
      value: function _renderAncestors() {
        var i = void 0;
        var j = void 0;
        var idx = void 0;
        var len = void 0;
        var ancestor = void 0;
        var ancestors = void 0;
        if (!this._ancestors.length) {
          ancestors = this.container.selectAll('.ancestor').remove();
          return this;
        }
        var ancestorData = this._ancestors.map(function (ancestor, idx) {
          return {
            name: ancestor.name,
            value: idx + 1,
            location: ancestor.location,
            isAncestor: true
          };
        });
        for (idx = j = 0, len = ancestorData.length; j < len; idx = ++j) {
          ancestor = ancestorData[idx];
          var prev = ancestorData[idx - 1];
          if (prev) {
            prev.children = [ancestor];
          }
        }

        // FIXME: this is pretty ugly, but we need to add links between ancestors
        var renderAncestor = {
          x: function (_this) {
            return function (d) {
              return 0;
            };
          }(this),
          y: function (_this) {
            return function (d) {
              return _this.height() - d.value * _this.cellHeight();
            };
          }(this),
          width: this.width(),
          height: this.cellHeight(),
          text: function (_this) {
            return function (d) {
              return "↩ " + getClassAndMethodName(d.data ? d.data.name : d.name);
            };
          }(this)
        };

        // JOIN
        ancestors = this.container.selectAll('.ancestor').data(FlameGraphUtils.partition(ancestorData[0]), function (d) {
          return d.location;
        });

        // UPDATE
        this._renderNodes(ancestors, renderAncestor, false, ancestorData);
        // ENTER
        var newAncestors = ancestors.enter().append('g').attr('class', 'ancestor');
        this._renderNodes(newAncestors, renderAncestor, true, ancestorData);
        // EXIT
        ancestors.exit().remove();
        return this;
      }
    }, {
      key: '_enableNavigation',
      value: function _enableNavigation() {
        var clickable = function (_this) {
          return function (d) {
            var ref = void 0;
            return Math.round(_this.width() - _this.x(d.x1 - d.x0)) > 0 && ((ref = d.children) != null ? ref.length : void 0);
          };
        }(this);

        this.container.selectAll('.node').classed('clickable', function (_this) {
          return function (d) {
            return clickable(d);
          };
        }(this)).on('click', function (_this) {
          return function (d) {
            if (_this.tip) {
              _this.tip.hide();
            }
            if (clickable(d)) {
              return _this.zoom(d, _d3Selection.event);
            }
          };
        }(this));
        this.container.selectAll('.ancestor').on('click', function (_this) {
          return function (d, idx) {
            if (_this.tip) {
              _this.tip.hide();
            }
            return _this.zoom(_this._ancestors[idx], _d3Selection.event);
          };
        }(this));
        return this;
      }
    }, {
      key: '_generateAccessors',
      value: function _generateAccessors(accessors) {
        var accessor = void 0;
        var results = [];
        for (var j = 0, len = accessors.length; j < len; j++) {
          accessor = accessors[j];
          results.push(this[accessor] = function (accessor) {
            return function (newValue) {
              if (!arguments.length) {
                return this["_" + accessor];
              }
              this["_" + accessor] = newValue;
              return this;
            };
          }(accessor));
        }
        return results;
      }
    }]);

    return FlameGraph;
  }();

  exports.default = FlameGraph;
});
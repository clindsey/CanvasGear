(function(window,undefined){
  window.canvas_gear = function(bind_elem_id,fps,scene,callback){
    new CanvasGear(bind_elem_id,fps,scene,callback);
  };
  var CanvasGear = function(bind_elem_id,fps,scene,callback){
    var self = {},
        bind_elem = document.getElementById(bind_elem_id),
        width = bind_elem.offsetWidth,
        height = bind_elem.offsetHeight,
        offset_left = bind_elem.offsetLeft,
        offset_top = bind_elem.offsetTop,
        engine,
        interval,
        last_update = (new Date()).getTime(),
        remainder;
    self.load = function(new_scene){
      if(engine) engine.destroy();
      self.__scene__ = new_scene;
      engine = new CanvasGraphics(bind_elem_id,fps);
      new self.__scene__(engine);
      engine.bind('update',mouse_timer_fn);
    };
    self.start = function(){
      interval = setInterval(function(){
        var now_time = new Date().getTime(),
            t_delta = now_time - (last_update + remainder);
        last_update = now_time;
        do{
          engine.update();
          t_delta -= fps;
        }while(t_delta > 1);
        remainder = t_delta;
        engine.draw();
      },1000 / (fps));
    };
    self.stop = function(){
      clearInterval(interval);
      engine.unbind(mouse_timer_fn);
    };
    self.draw = function(){
      engine.draw();
    };
    self.update = function(){
      engine.update();
    };
    var mouse_x = 0,
        mouse_y = 0;
    var mouse_timer_fn = function(){
      engine.trigger('_input',{'type':'mousemove','data':{'x':mouse_x,'y':mouse_y}});
    };
    var update_event = function(event){
      mouse_x = event.pageX - offset_left;
      mouse_y = event.pageY - offset_top;
    };
    var input_event = function(event){
      engine.trigger('_input',{'type':event.type,'data':{'x':mouse_x,'y':mouse_y}});
    };
    bind_event(window,'resize',function(){ offset_left = bind_elem.offsetLeft; offset_top = bind_elem.offsetTop; });
    bind_event(document,'keydown',input_event);
    bind_event(document,'keypress',input_event);
    bind_event(document,'keyup',input_event);
    bind_event(bind_elem,'mousemove',update_event);
    bind_event(bind_elem,'mousedown',input_event);
    bind_event(bind_elem,'mouseup',input_event);
    bind_event(bind_elem,'mouseover',input_event);
    bind_event(bind_elem,'mouseout',input_event);
    bind_event(bind_elem,'touchstart',function(e){ e.changedTouches[0].type = 'mousedown'; update_event(e.changedTouches[0]); input_event(e.changedTouches[0]); e.preventDefault(); });
    bind_event(bind_elem,'touchmove',function(e){ e.changedTouches[0].type = 'mousemove'; update_event(e.changedTouches[0]); input_event(e.changedTouches[0]); e.preventDefault(); });
    bind_event(bind_elem,'touchend',function(e){ e.changedTouches[0].type = 'mouseup'; update_event(e.changedTouches[0]); input_event(e.changedTouches[0]); e.preventDefault(); });
    self.load(scene);
    if(callback) callback(self);
    return self;
  };
  var CanvasGraphics = function(bind_elem_id,fps){
    var self = new EventDispatcher(),
        bind_elem = document.getElementById(bind_elem_id),
        canvas_elem = bind_to_elem(bind_elem_id);
    var last_target,
        target,
        context = canvas_elem.getContext('2d'),
        canvas = context.canvas,
        width = canvas.width,
        height = canvas.height,
        display_manager = new DisplayManager(),
        grid_manager = new GridManager(width,height,64);
    self.width = width;
    self.height = height;
    self.update = function(){
      update_all();
      self.trigger('update');
      grid_manager.update();
    };
    self.draw = function(){
      draw_all();
      self.trigger('draw');
    };
    self.destroy = function(){
      self.clear_bindings();
      display_manager.destroy();
    };
    self.add = function(displayable){
      display_manager.add(displayable);
    };
    self.add_interactive = function(displayable){
      self.add(displayable);
      grid_manager.add(displayable);
      displayable.bind('remove',function(){
        if(last_target && last_target.$$id === displayable.$$id) last_target = undefined;
        if(target && target.$$id === displayable.$$id) target = undefined;
      });
    };
    self.remove = function(displayable){
      display_manager.remove(displayable);
    };
    self.to_top = function(displayable){
      display_manager.to_top(displayable);
    };
    self.set_depth = function(displayable,depth){
      display_manager.set_depth(displayable,depth);
    };
    var update_all = function(){
      display_manager.map(function(displayable){
        displayable.trigger('update');
      });
    };
    var draw_all = function(){
      canvas.width = canvas.width
      display_manager.map(draw_displayable);
    };
    var draw_displayable = function(displayable){
      displayable.trigger('draw');
      draw_display_object(displayable);
      if(displayable.$$text){
        draw_text_object(displayable);
      };
    };
    var draw_text_object = function(displayable){
      displayable.text = displayable.text + '';
      var font = displayable.get_font(),
          glyphs = font.glyphs,
          chars = displayable.text.split(''),
          jumps = font.spacing(chars,0,0),
          view_box = font.view_box(),
          glyph,
          i = -1,
          j = -1,
          x = displayable.x,
          chr,
          text_width = displayable.calculate_width(),
          color = displayable.style['color'],
          size = displayable.style['font-size'],
          height = size,
          rounded_height = Math.ceil(height),
          rounding_factor = rounded_height / height,
          scale = height / view_box.height;
      context.save();
      switch(displayable.style['text-align']){
        case 'center':
          x = displayable.x + (displayable.width / 2) - (text_width / 2);
          break;
        case 'right':
          x = displayable.x + displayable.width - text_width;
          break;
        default:
          x = displayable.x;
          break;
      };
      context.fillStyle = color;
      context.globalAlpha = displayable.style['alpha'];
      context.rotate(displayable.rotation * Math.PI / 180);
      context.translate(x,displayable.y + ((height - 2) / 3) + (displayable.height / 2));
      context.scale(scale,scale * rounding_factor);
      while(chr = chars[++i]){
        glyph = glyphs[chars[i]];
        if(!glyph) continue;
        if(glyph.d){
          context.beginPath();
          if(glyph.code) interpret(glyph.code,context);
          else glyph.code = generate_from_vml('m' + glyph.d,context);
          context.fill();
        };
        context.translate(jumps[++j],0);
      };
      context.restore();
    };
    var draw_display_object = function(displayable){
      context.save();
      context.globalAlpha = displayable.style['alpha'];
      context.translate(displayable.x,displayable.y);
      if(displayable.style['border-width'] > 0){
        context.strokeStyle = displayable.style['border-color'];
        context.lineWidth = displayable.style['border-width'];
      };
      context.fillStyle = displayable.style['background-color'];
      if(displayable.vertices.length > 0){
        context.beginPath();
        var vertex;
        for(var i = 0,l = displayable.vertices.length; i < l; i++){
          vertex = displayable.vertices[i]
          if(i === 0) context.moveTo(vertex.x,vertex.y);
          else context.lineTo(vertex.x,vertex.y);
        };
        if(displayable.$$line !== true) context.closePath();
        context.fill();
        if(displayable.style['border-width'] > 0) context.stroke();
      };
      if(displayable.style.gradients.length > 0){
        for(var i = 0, il = displayable.style.gradients.length; i < il; i++){
          var gradient = displayable.style.gradients[i],
              g;
          if(gradient.type === 'radial'){
            g = context.createRadialGradient(gradient.points[0],gradient.points[1],gradient.points[2],gradient.points[3],gradient.points[4],gradient.points[5]);
          }else{
            g = context.createLinearGradient(gradient.points[0],gradient.points[1],gradient.points[2],gradient.points[3]);
          };
          for(var j = 0, jl = gradient.stops.length; j < jl; j++){
            var stop = gradient.stops[j];
            g.addColorStop(stop[0],stop[1]);
          };
          context.fillStyle = g;
          context.fill();
        };
      };
      if(displayable.get_displayables){
        var displayable_children = displayable.get_displayables();
        for(var i = 0,il = displayable_children.length; i < il; i++){
          draw_displayable(displayable_children[i]);
        };
      };
      context.restore();
    };
    self.bind('_input',function(e){
      var out_e = e.data,
          candidates = grid_manager.get_nearby(out_e.x,out_e.y),
          target_candidate = undefined,
          contact;
      for(var i = 0, il = candidates.length; i < il; i++){
        var v = candidates[i];
        contact = point_in_polygon({'x':out_e.x,'y':out_e.y},v);
        if(contact && !target_candidate) target_candidate = v;
        else if(contact && target_candidate && v.$$depth > target_candidate.$$depth) target_candidate = v;
      };
      target = target_candidate; // !!
      out_e.target = target;
      if(e.type === 'mousedown'){
        if(target){
          target.$$mousedown = true;
          target.trigger('mousedown',out_e);
        };
      }else if(e.type === 'mousemove'){
        if(last_target && target != last_target){
          if(last_target.$$mouseover){
            last_target.$$mousedown = false;
            last_target.$$mouseover = false;
            last_target.trigger('mouseout',out_e);
          };
        };
        if(target){
          if(!target.$$mouseover){
            target.trigger('mouseover',out_e);
            target.$$mouseover = true;
          }else{
            target.trigger('mousemove',out_e);
          };
        };
      }else if(e.type === 'mouseup'){
        if(target){
          target.$$mousedown = false;
          target.trigger('mouseup',out_e);
        };
      };
      last_target = target; // !!
      self.trigger('mousemove',out_e);
    });
    return self;
  };
  var DisplayManager = function(){
    var self = {};
        displayables = [],
        highest_depth = -1,
        lookup = {};
    self.destroy = function(){
      self.clear_bindings();
      for(var displayable in lookup){
        var index = lookup[displayable.$$id];
        displayables[index] = undefined;
        delete lookup[displayable];
      };
    };
    self.add = function(displayable){
      if(displayable.$$depth === undefined) displayable.$$depth = ++highest_depth;
      if(displayable.$$depth > highest_depth) highest_depth = displayable.$$depth;
      var d = displayable.$$depth;
      if(displayables[d] === undefined) displayables[d] = [];
      lookup[displayable.$$id] = displayables[d].length;
      displayables[d][displayables[d].length] = displayable;
    };
    self.remove = function(displayable){
      displayable.trigger('remove');
      var index = lookup[displayable.$$id];
      delete displayables[displayable.$$depth][index];
    };
    self.map = function(callback){
      for(var i = 0,l = displayables.length,j,jl; i < l; i++){
        for(j = 0,jl = displayables[i].length; j < jl; j++){
          if(displayables[i] !== undefined && displayables[i][j] !== undefined) callback(displayables[i][j]);
        };
      };
    };
    self.set_depth = function(displayable,new_depth){
      var l = lookup[displayable.$$id];
      delete lookup[displayable.$$id];
      displayables[displayable.$$depth][l] = undefined;
      displayable.$$depth = new_depth;
      if(new_depth > highest_depth) highest_depth = new_depth;
      if(!displayables[new_depth]) displayables[new_depth] = [];
      var i = displayables[new_depth].length;
      displayables[new_depth][i] = displayable;
      lookup[displayable.$$id] = i;
    };
    self.to_top = function(displayable){
      self.set_depth(displayable,highest_depth + 1);
    };
    return self;
  };
  var GridManager = function(width,height,grid_size){
    var self = {},
        grid_width = Math.floor(width / grid_size),
        displayables = {},
        positions = [];
    self.add = function(displayable){
      displayable.$$interactive = true;
      displayables[displayable.$$id] = displayable;
      displayable.bounds = {'min_x':undefined,'min_y':undefined,'max_x':undefined,'max_y':undefined};
      displayable.bind('update',function(){
        var display_object = this;
        if(this.$$last_vertices !== this.vertices){
          for(var i = 0, il = display_object.vertices.length; i < il; i++){
            var v = display_object.vertices[i];
            if(!display_object.bounds.max_x || v.x + display_object.x > display_object.bounds.max_x) display_object.bounds.max_x = v.x + display_object.x;
            if(!display_object.bounds.min_x || v.x + display_object.x < display_object.bounds.min_x) display_object.bounds.min_x = v.x + display_object.x;
            if(!display_object.bounds.max_y || v.y + display_object.y > display_object.bounds.max_y) display_object.bounds.max_y = v.y + display_object.y;
            if(!display_object.bounds.min_y || v.y + display_object.y < display_object.bounds.min_y) display_object.bounds.min_y = v.y + display_object.y;
          };
          display_object.$$last_vertices = display_object.vertices;
        };
      });
      var display_object = displayable;
      for(var i = 0, il = display_object.vertices.length; i < il; i++){
        var v = display_object.vertices[i];
        if(!display_object.bounds.max_x || v.x + display_object.x > display_object.bounds.max_x) display_object.bounds.max_x = v.x + display_object.x;
        if(!display_object.bounds.min_x || v.x + display_object.x < display_object.bounds.min_x) display_object.bounds.min_x = v.x + display_object.x;
        if(!display_object.bounds.max_y || v.y + display_object.y > display_object.bounds.max_y) display_object.bounds.max_y = v.y + display_object.y;
        if(!display_object.bounds.min_y || v.y + display_object.y < display_object.bounds.min_y) display_object.bounds.min_y = v.y + display_object.y;
      };
      display_object.$$last_vertices = display_object.vertices;
    };
    self.remove = function(displayable){
      return delete displayables[displayable.__id__];
    };
    self.update = function(){
      var displayable,
          x,
          y,
          index,
          obj_grid_min_x,
          obj_grid_min_y,
          obj_grid_max_x,
          obj_grid_max_y,
          obj_grid_height,
          obj_grid_width,
          xl,
          yl;
      positions = [];
      for(var o in displayables){
        displayable = displayables[o];
        obj_grid_min_x = Math.floor(displayable.bounds.min_x / grid_size);
        obj_grid_min_y = Math.floor(displayable.bounds.min_y / grid_size);
        obj_grid_max_x = Math.ceil(displayable.bounds.max_x / grid_size);
        obj_grid_max_y = Math.ceil(displayable.bounds.max_y / grid_size);
        obj_grid_width = Math.ceil(obj_grid_max_x - obj_grid_min_x);
        obj_grid_height = Math.ceil(obj_grid_max_y - obj_grid_min_y);
        xl = obj_grid_min_x + obj_grid_width;
        yl = obj_grid_min_y + obj_grid_height;
        for(y = obj_grid_min_y; y < yl; y++){
          for(x = obj_grid_min_x; x < xl; x++){
            index = x + grid_width * y;
            if(!positions[index]) { positions[index] = [displayable]; continue; }
            positions[index][positions[index].length] = displayable;
          };
        };
      };
    };
    self.get_nearby = function(check_x,check_y){
      var x = Math.floor(check_x / grid_size),
          y = Math.floor(check_y / grid_size),
          index = x + grid_width * y;
      return positions[index] || [];
    };
    return self;
  };
  var FontFamily = function(){
    var self = {},
        styles = {};
    self.add = function(font){
      (styles[font.style] || (styles[font.style] = {}))[font.weight] = font;
    };
    self.get = function(style,weight){
      var weights = styles[style] || styles.normal || styles.italic || styles.oblique;
      if(!weights) return undefined;
      weight = {
          'normal':400,
          'bold':700
        }[weight] || parseInt(weight,10);
      if(weights["" + weight]) return weights["" + weight];
    };
    return self;
  };
  var Font = function(data){
    var self = {},
        face = data.face,
        word_separators = {
            '\u0020':1,
            '\u00a0':1,
            '\u3000':1
          };
    self.width = data.w;
    self.base_size = parseInt(face['units-per-em'],10);
    self.family = face['font-family'].toLowerCase();
    self.weight = face['font-weight'];
    self.style = face['font-style'] || 'normal';
    self.ascent = 0 - parseInt(face.ascent,10);
    self.descent = 0 - parseInt(face.descent,10);
    self.height = (0 - self.ascent) + self.descent;
    self.glyphs = (function(glyphs){
      var key,
          fallbacks = {
              '\u2011':'\u002d',
              '\u00ad':'\u2011'
            };
      for(key in fallbacks){
        if(!fallbacks.hasOwnProperty(key)) continue;
        if(!glyphs[key]) glyphs[key] = glyphs[fallbacks[key]];
      };
      return glyphs;
    })(data.glyphs);
    self.view_box = function(){
      var parts = face.bbox.split(/\s+/),
          box = {
              'min_x':parseInt(parts[0],10),
              'min_y':parseInt(parts[1],10),
              'max_x':parseInt(parts[2],10),
              'max_y':parseInt(parts[3],10)
            };
        box.width = box.max_x - box.min_x;
        box.height = box.max_y - box.min_y;
        return box;
    };
    self.spacing = function(chars,letter_spacing,word_spacing){
      var gylphs = self.glyphs,
          gylph,
          kerning,
          k,
          jumps = [],
          width = 0,
          w,
          i = -1,
          j = -1,
          chr;
      while(chr = chars[++i]){
        glyph = self.glyphs[chr];
        if(!glyph) continue;
        if(kerning){
          width -= k = kerning[chr] || 0;
          jumps[j] -= k;
        };
        w = glyph.w;
        if(isNaN(w)) w = +glyph.w;
        if(w > 0){
          w += letter_spacing;
          if(word_separators[chr]) w += word_spacing;
        };
        width += jumps[++j] = ~~w;
        kerning = glyph.k;
      };
      jumps.total = width;
      return jumps;
    };
    return self;
  };
  window.CanvasGear = {
    'register_font':function(data){
      var self = this,
          font = new Font(data),
          family = font.family;
      if(!self.fonts[family]) self.fonts[family] = new FontFamily();
      self.fonts[family].add(font);
    },
    'fonts':{}
  };
  var interpret = function(code,context){
    for(var i = 0, il = code.length; i < il; i++){
      var line = code[i];
      context[line.m].apply(context,line.a);
    };
  };
  var generate_from_vml = function(path,context){
    var at_x = 0,
        at_y = 0,
        code = [],
        re = /([mrvxe])([^a-z]*)/g,
        match;
    generate:for(var i = 0; match = re.exec(path); ++i){
      var c = match[2].split(',');
      switch(match[1]){
        case 'v':
          code[i] = {'m':'bezierCurveTo','a':[at_x + ~~c[0],at_y + ~~c[1],at_x + ~~c[2],at_y + ~~c[3],at_x += ~~c[4],at_y += ~~c[5]]};
          break;
        case 'r':
          code[i] = {'m':'lineTo','a':[at_x += ~~c[0],at_y += ~~c[1]]};
          break;
        case 'm':
          code[i] = {'m':'moveTo','a':[at_x = ~~c[0],at_y = ~~c[1]]};
          break;
        case 'x':
          code[i] = {'m':'closePath','a':[]};
          break;
        case 'e':
          break generate;
      };
      context[code[i].m].apply(context,code[i].a);
    };
    return code;
  };
  var bind_event = function(obj,type,fn){
    if(obj.attachEvent){
      obj['e' + type + fn] = fn;
      obj[type + fn] = function() { obj['e' + type + fn](window.event); };
      obj.attachEvent('on' + type,obj[type + fn]);
    }else{
     obj.addEventListener(type,fn,false);
    };
  };
  var bind_to_elem = function(elem_id){
    var bind_elem = document.getElementById(elem_id),
        canvas_elem = document.createElement('canvas'),
        width = bind_elem.offsetWidth,
        height = bind_elem.offsetHeight;
    canvas_elem.width = width;
    canvas_elem.height = height;
    bind_elem.innerHTML = '';
    bind_elem.appendChild(canvas_elem);
    if(document.all && G_vmlCanvasManager) canvas_elem = G_vmlCanvasManager.initElement(canvas_elem);
    return canvas_elem;
  };
  var point_in_polygon = function(point,polygon){
    var x = point.x,
        y = point.y,
        vertices = polygon.vertices,
        vertex,
        last_vertex,
        i,j,vy,vx,vly,vlx,
        contact = false,
        vert_count = vertices.length;
    for(i = 0, j = vert_count - 1; i < vert_count; j = i++){
      vertex = vertices[i];
      last_vertex = vertices[j];
      vx = vertex.x + polygon.x;
      vy = vertex.y + polygon.y;
      vlx = last_vertex.x + polygon.x;
      vly = last_vertex.y + polygon.y;
      if(((vy > y) != (vly > y)) && (x < (vlx - vx) * (y - vy) / (vly - vy) + vx)){
        contact = !contact;
      };
    };
    return contact;
  };
})(window);
(function(window,undefined){
  window.EventDispatcher = function(){
    var lookup = {},
        subscribers = {},
        self = {};
    self.bind = function(type,callback){
      if(!subscribers[type]) subscribers[type] = [];
      var l = subscribers[type].length;
      subscribers[type][l] = callback;
      lookup[callback] = {'index':l,'type':type};
    };
    self.unbind = function(callback){
      var binding = lookup[callback];
      subscribers[binding.type][binding.index] = undefined;
      delete lookup[callback];
    };
    self.trigger = function(type,data){
      if(subscribers[type] === undefined) return;
      for(var i = 0,l = subscribers[type].length; i < l; i++){
        var subscriber = subscribers[type][i];
        if(subscriber && subscriber.call) subscriber.call(self,data);
      };
    };
    self.clear_bindings = function(){
      for(var callback in lookup){
        var binding = lookup[callback];
        subscribers[binding.type][binding.index] = undefined;
        delete lookup[callback];
      };
    };
    return self;
  };
  window.DisplayObject = function(x,y,style){
    var self = new EventDispatcher();
    self.x = x;
    self.y = y;
    self.rotation = 0;
    self.$$last_rotation = self.rotation;
    self.vertices = [];
    self.$$last_vertices = self.vertices;
    self.style = {
        'background-color':(style['background-color'] || 'rgba(0,0,0,0)'),
        'border-width':(style['border-width'] || 0),
        'border-color':(style['border-color'] || 'rgba(0,0,0,0)'),
        'alpha':(style['alpha'] || 1.0),
        'gradients':(style['gradients'] || [])
      };
    self.$$id = new_global_id();
    self.add_vertex = function(x,y){
      self.vertices[self.vertices.length] = {'x':x,'y':y};
    };
    self.bind('draw',function(){
      if(self.$$last_rotation !== self.rotation){
        if(self.rotation > 360) self.rotation = self.rotation % 360;
        if(self.rotation < 0) self.rotation += 360;
        var old_vertices = self.vertices,
            angle = self.rotation - self.$$last_rotation;
        self.vertices = [];
        for(var i = 0, il = old_vertices.length; i < il; i++){
          var point = old_vertices[i],
              x_old = point.x,
              y_old = point.y,
              x_new = x_old * Math.cos(convert_to_radians(angle)) - y_old * Math.sin(convert_to_radians(angle)),
              y_new = x_old * Math.sin(convert_to_radians(angle)) + y_old * Math.cos(convert_to_radians(angle));
          self.add_vertex(x_new,y_new);
        };
        self.$$last_rotation = self.rotation;
      };
    });
    return self;
  };
  window.DisplayObject.Line = function(x,y,style){
    var self = new DisplayObject(x,y,style);
    self.$$line = true;
    return self;
  };
  window.DisplayObject.Rectangle = function(x,y,width,height,style){
    var self = new DisplayObject(x,y,style);
    self.width = width;
    self.height = height;
    self.add_vertex(0,0);
    self.add_vertex(width,0);
    self.add_vertex(width,height);
    self.add_vertex(0,height);
    return self;
  };
  window.DisplayObject.Container = function(x,y,width,height,style){
    var self = new DisplayObject.Rectangle(x,y,width,height,style),
        displayables = [],
        lookup = {};
    self.$$last_container_rotation = self.rotation;
    self.get_displayables = function(){
      var out = [];
      for(var i = 0,il = displayables.length; i < il; i++){
        if(displayables[i] !== undefined) out[out.length] = displayables[i];
      };
      return out;
    };
    self.add = function(displayable){
      var index = displayables.length;
      displayables[index] = displayable;
      lookup[displayable.$$id] = index;
    };
    self.remove = function(displayable){
      var index = lookup[displayable.$$id];
      delete displayables[index];
    };
    self.bind('update',function(){
      if(self.$$last_container_rotation !== self.rotation){
        var r_offset = self.rotation - self.$$last_container_rotation,
            displayables = self.get_displayables();
        for(var i = 0, il = displayables.length; i < il; i++){
          var displayable = displayables[i];
          displayable.rotation += r_offset;
        };
        self.$$last_container_rotation = self.rotation;
      };
    });
    return self;
  };
  DisplayObject.Polygon = function(x,y,radius,edge_count,rotation,style){
    var self = new DisplayObject(x,y,style);
    self.radius = radius;
    self.edge_count = edge_count;
    self.rotation = rotation;
    var point_index,
        point_increment = 360 / self.edge_count,
        plot_x,
        plot_y;
    for(point_index = 0; point_index <= 360; point_index += point_increment){
      plot_x = Math.sin(convert_to_radians(point_index + self.rotation + 180)) * (0 - self.radius);
      plot_y = Math.cos(convert_to_radians(point_index + self.rotation + 180)) * self.radius;
      self.add_vertex(plot_x,plot_y);
    };
    return self;
  };
  DisplayObject.Text = function(text,x,y,width,height,style){
    var self = new DisplayObject.Rectangle(x,y,width,height,style);
    self.text = text;
    self.$$text = true;
    self.style['font-family'] = (style['font-family'] || 'Myriad Pro');
    self.style['font-size'] = (style['font-size'] || 16);
    self.style['text-align'] = (style['text-align'] || 'left');
    self.style['font-weight'] = (style['font-weight'] || 400);
    self.style['font-style'] = (style['font-style'] || 'normal');
    self.style['color'] = (style['color'] || '#333333');
    self.get_font = function(){
      return CanvasGear.fonts[self.style['font-family'].toLowerCase()].get(self.style['font-style'],self.style['font-weight']);
    };
    self.calculate_width = function(){
      var font = self.get_font(),
          chars = text.split(''),
          jumps = font.spacing(chars,0,0),
          view_box = font.view_box(),
          size = self.style['font-size'],
          height = size,
          rounded_height = Math.ceil(height),
          rounding_factor = rounded_height / height,
          scale = height / view_box.height,
          width = 0;
      for(var i = 0, il = chars.length; i < il; i++){
        var v = chars[i];
        if(font.glyphs[v]){
          width += (font.glyphs[v].w) * scale;
        };
      };
      return width;
    };
    return self;
  };
  var convert_to_radians = function(degrees){
    return Math.PI / 180 * degrees;
  };
  var new_global_id = function(){
    var chars = ['0','1','2','3','4','5','6','7','8','9','A','B','C','D','E','F','G'],uuid = [],
        r,i = 36;
    uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-';
    uuid[14] = '4';
    while (i--) {
      if (!uuid[i]) {
        r = Math.random()*16|0;
        uuid[i] = chars[(i == 19) ? (r & 0x3) | 0x8 : r];
      }
    }
    return uuid.join('');
  };
})(window);

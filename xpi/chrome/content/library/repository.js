function Repository(){
  this.register.apply(this, arguments);
}

Repository.prototype = {
  get size(){
    return this.names.length;
  },

  get names(){
    return this.values.map(itemgetter('name'));
  },

  get values(){
    return map(itemgetter(1), this).filter(function(v){
      return v.name;
    });
  },

  clear : function(){
    this.names.forEach(function(name){
      delete this[name];
    }, this);
  },

  find : function(name){
    return this.values.filter(function(i){
      return i.name && i.name.search(name) != -1;
    });
  },

  copyTo : function(t){
    forEach(this, function(m){
      t[m[0]] = m[1];
    });
    return t;
  },

  check : function(){
    var args = arguments;
    return reduce(function(memo, i){
      if(i.check && i.check.apply(i, args))
        memo.push(i);
      return memo;
    }, this.values, []);
  },

  /**
   * 新しい定義を追加する。
   *
   * @param {Array} defs
   * @param {String} target 追加対象。この名前の前後に追加される。
   * @param {Boolean} after 追加対象の前に追加するか否か(後か)。
   */
  register : function(defs, target, after){
    if(!defs)
      return;

    defs = [].concat(defs);
    if(target){
      var vals = this.values;
      this.clear();

      for(var i=0 ; i < vals.length ; i++)
        if(vals[i].name == target)
          break;

      vals.splice.apply(vals, [(after? i+1 : i), 0].concat(defs));
      defs = vals;
    }

    defs.forEach(function(d){
      this[d.name] = d;
    }, this);
  },
}

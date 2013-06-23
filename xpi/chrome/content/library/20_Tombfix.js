var Tombloo;
var Tombfix = Tombloo = {
	SCHEMA_VERSION : 1,
	
	get root(){
		return (this._root || (this._root = getDataDir())).clone();
	},
	
	set root(root){
		return this._root = root;
	},
	
	get db(){
		if(this._db)
			return this._db;
		
		var file = this.root;
		file.append('tombfix.sqlite');
		
		return this.db = new Database(file);
	},
	
	set db(db){
		this._db = db;
		this.root = db.connection.databaseFile.parent;
		
		(!db.tableExists('photos'))? this.initialize() : this.migration();
		
		return db;
	},
	
	initialize : function(){
		with(this){
			Tag.initialize();
			Regular.initialize();
			Photo.initialize();
			Video.initialize();
			Link.initialize();
			Conversation.initialize();
			Quote.initialize();
			
			Post.initialize();
			
			db.version = SCHEMA_VERSION;
		}
	},
	
	migration : function(){
		with(this){
			if(db.version!=0)
				return;
			
			Post.deinitialize();
			Post.initialize();
			
			Tag.initialize();
			
			db.execute(commentToText(function(){/*
				CREATE TABLE temp (
					id        INTEGER PRIMARY KEY, 
					user      TEXT, 
					date      INTEGER, 
					body      TEXT, 
					imageId   TEXT, 
					extension TEXT, 
					file75    INTEGER NOT NULL, 
					file100   INTEGER NOT NULL, 
					file250   INTEGER NOT NULL, 
					file400   INTEGER NOT NULL, 
					file500   INTEGER NOT NULL);
				INSERT INTO temp(
					id, user, date, body, imageId, extension,
					file75, file100, file250, file400, file500) 
				SELECT 
					id, user, date, body, (CASE WHEN (revision IS NULL OR revision = "") THEN imageId ELSE imageId || '_' || revision END), 'jpg',
					0, 0, 0, 0, 0 
				FROM 
					photos;
				DROP TABLE photos;
				ALTER TABLE temp RENAME TO photos;
			*/}));
			
			db.version = SCHEMA_VERSION;
			db.vacuum();
		}
	},
	
	Entity : function(def){
		var Class = extend(Entity(def), {
			get db(){
				return Tombfix.db;
			},
		});
		
		addBefore(Class, 'insert', function(model){
			if(!(model instanceof Class))
				model = new Class(model);
			
			if(!model._tags || !model._tags.length)
				return;
			
			var type = Class.definitions.name.slice(0, -1);
			model._tags.forEach(function(tag){
				Tombfix.Tag.insert({
					id   : model.id,
					type : type,
					tag  : tag,
				});
			});
		});
		
		Class.prototype.__defineGetter__('tags', function(){
			if(this._tags)
				return this._tags;
			
			return this._tags = Tombfix.Tag.findById(this.id);
		});
		
		Class.prototype.__defineSetter__('tags', function(tags){
			return this._tags = tags;
		});
		
		return Class;
	},
}


Tombfix.Tag = Tombfix.Entity({
	name : 'tags',
	fields : {
		id   : 'INTEGER',
		type : 'TEXT',
		tag  : 'TEXT',
	}
});
addAround(Tombfix.Tag, 'initialize', function(proceed, args, target){
	proceed(args);
	target.db.connection.executeSimpleSQL('CREATE INDEX idx_tags_id ON tags(id ASC)');
});

Tombfix.Regular = Tombfix.Entity({
	name : 'regulars',
	fields : {
		id    : 'INTEGER PRIMARY KEY',
		user  : 'TEXT',
		date  : 'TIMESTAMP',
		
		title : 'TEXT',
		body  : 'TEXT',
	}
});

Tombfix.Photo = Tombfix.Entity({
	name : 'photos',
	fields : {
		id        : 'INTEGER PRIMARY KEY',
		user      : 'TEXT',
		date      : 'TIMESTAMP',
		
		body      : 'TEXT',
		imageId   : 'TEXT',
		extension : 'TEXT',
		
		file75    : 'INTEGER NOT NULL',
		file100   : 'INTEGER NOT NULL',
		file250   : 'INTEGER NOT NULL',
		file400   : 'INTEGER NOT NULL',
		file500   : 'INTEGER NOT NULL',
	}
});

Tombfix.Video = Tombfix.Entity({
	name : 'videos',
	fields : {
		id     : 'INTEGER PRIMARY KEY',
		user   : 'TEXT',
		date   : 'TIMESTAMP',
		
		body   : 'TEXT',
		source : 'TEXT',
		player : 'TEXT',
	}
});

Tombfix.Link = Tombfix.Entity({
	name : 'links',
	fields   : {
		id     : 'INTEGER PRIMARY KEY',
		user   : 'TEXT',
		date   : 'TIMESTAMP',
		
		title  : 'TEXT',
		source : 'TEXT',
		body   : 'TEXT',
	}
});

Tombfix.Conversation = Tombfix.Entity({
	name : 'conversations',
	fields : {
		id    : 'INTEGER PRIMARY KEY',
		user  : 'TEXT',
		date  : 'TIMESTAMP',
		
		title : 'TEXT',
		body  : 'TEXT',
	}
});

Tombfix.Quote = Tombfix.Entity({
	name : 'quotes',
	fields : {
		id     : 'INTEGER PRIMARY KEY',
		user   : 'TEXT',
		date   : 'TIMESTAMP',
		
		body   : 'TEXT',
		source : 'TEXT',
	}
});


extend(Tombfix.Photo, {
	findUsers : function(){
		return Tombfix.Photo.find('SELECT user FROM photos GROUP BY user ORDER BY user').map(itemgetter('user'));
	},
	
	getPhotoDir : function(size){
		var dir = Tombfix.root;
		with(dir){
			append('photo');
			if(size)
				append(size);
			
			if(!exists())
				create(DIRECTORY_TYPE, 0666);
		}
		return dir;
	},
	
	getImageInfo : function(file){
		file = file.split('/').pop();
		
		var ts = (/(.*)_(.+)\.(.+)/).exec(file);
		return {
			id : ts[1],
			size : ts[2],
			extension : ts[3],
		}
	},
});

extend(Tombfix.Photo.prototype, {
	file75  : 0, 
	file100 : 0,
	file250 : 0,
	file400 : 0, 
	file500 : 0, 
	
	get url(){
		return 'http://' + this.user + '.tumblr.com/post/' + this.id;
	},
	
	set url(target){
	},
	
	checkFile : function(size){
		var file = this.getFile(size);
		
		// 通信エラーファイルなら削除する(MIGRATION 0->1)
		if(file.exists() && 
			(220 < file.fileSize && file.fileSize < 240) && 
			getContents(file).indexOf('xml') != -1){
			
			file.remove(false);
			
			// 拡張子を空にし再ダウンロードを促す
			this.extension = '';
			this.save();
		}
		
		return file.exists();
	},
	
	getFile : function(size){
		var file = Tombfix.Photo.getPhotoDir(size);
		file.append(this.getFileName(size));
		return file;
	},
	
	getFileName : function(size){
		return this.imageId + '_' + size + (size==75? 'sq' : '') + '.' + this.extension;
	},
});

Tombfix.Post = Tombfix.Entity({name : 'posts'});
extend(Tombfix.Post, {
	insert : function(post){
		Tombfix[post.type.capitalize()].insert(post);
	},
	
	initialize : function(){
		try{
			return this.db.execute(commentToText(function(){/*
				CREATE VIEW posts AS 
				SELECT "regular" AS type, id, user, date, 
					title, 
					body, 
					"" AS source, 
					"" AS player, 
					"" AS imageId 
				FROM regulars 
				UNION ALL 
				SELECT "photo" AS type, id, user, date, 
					"" AS title, 
					body, 
					"" AS source, 
					"" AS player, 
					imageId 
				FROM photos 
				UNION ALL 
				SELECT "video" AS type, id, user, date, 
					"" AS title, 
					body, 
					source, 
					player, 
					"" AS imageId 
				FROM videos 
				UNION ALL 
				SELECT "link" AS type, id, user, date, 
					title, 
					body, 
					source, 
					"" AS player, 
					"" AS imageId 
				FROM links 
				UNION ALL 
				SELECT "conversation" AS type, id, user, date, 
					title, 
					body, 
					"" AS source, 
					"" AS player, 
					"" AS imageId 
				FROM conversations 
				UNION ALL 
				SELECT "quote" AS type, id, user, date, 
					"" AS title, 
					body, 
					source, 
					"" AS player, 
					"" AS imageId 
				FROM quotes 
			*/}));
		} catch(e if e instanceof Database.AlreadyExistsException){}
	},
	
	deinitialize : function(){
		return this.db.execute('DROP VIEW posts');
	},
});

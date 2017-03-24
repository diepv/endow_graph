/**
 * Created by viviandiep on 3/9/17.
 */
var when = require('when');
var https = require('https');
var Snoocore = require('snoocore');
var ldaUtils = require(__dirname + '/ldaUtils');
var mongo = require('mongodb');
var Server = mongo.Server;
var db;
BSON = mongo.BSONPure;

mongo.MongoClient.connect(process.env.MONGODB_URI, function(err, database){
    if(err){
        console.log(err);
        process.exit(1);
    }

    db = database;
});

var reddit = new Snoocore({
    userAgent:"strappydata/0.1 by ss_17",
    oauth:{
        type:'script',
        key:'aLQrP5YcWLTCdA',
        secret:'hGPJ8KjyS1lPNINLl_l2WHlSqcQ',
        username:process.env.REDDIT_USERNAME,
        password:process.env.REDDIT_PASSWORD,
        redirectUri:'http://localhost:3000/printIt',
        scope:['identity', 'read', 'vote']
    }
});
//db.open(function(err, db){
//    if(err){
//        console.log("db open error:", err);
//    }else{
//        console.log("db reddit connected");
//    }
//});

function logThis(name, comment){
    if(name){
        if(typeof comment == Object || typeof comment == 'object' || typeof comment == undefined){
            console.log("  //  ", name);
            console.log(comment);
        }else{
            console.log("  //  "+name+"  "+ comment);
        }

    }else{
        console.log(comment);
    }

}

exports.getThem = function(req,res){
    process.stdout.write('in getThem');
  gogo(function(stuff){
     // process.stdout.write("sending stuff");
     // var jsoned = stuff;
     // var titles = [];
     // var posts = jsoned.get.data.children;
     // var index;
     // for(var index in posts){
     //       console.log('child: ', posts[index]);
     // }
     //res.send(jsoned);
    });
};

function processPost(postData){


}

exports.printMe = function(req,res){
    process.stdout.write("printme");
};
function printSlice(slice){
    db.collection('posts_year', function(error, collection){
        //if fullname already exists, replace (thereby keeping updated version, dumping old one)
        //else insert new record into collection

        slice.stickied.forEach(function(item,i){
            console.log('item data: ', item.data);
            collection.updateOne({name:item.data.name},item.data,{upsert:true, w:1}, function(err,d){
                if(err){
                    console.log(err);
                }else{
                    console.log('no error, d: ', d);
                }
            });
            //console.log("**STICKY**", item.data.title.substring(0,20) + "...");
        });
        console.log("children length:",slice.children.length);

        slice.children.forEach(function(child, i){
            console.log('children in slice, index: ', i);
            console.log("child.data.title: ", child.data.title);
            collection.updateOne({name:child.data.name},child.data,{upsert:true}, function(err, d){
                if(err){
                    console.log(err);
                }
            });
            //console.log(slice.count + i +1, child.data.title.substring(0,20) + "...");
        });

    });
}


function gogo(callback){

    var sliceCount = 0; //holds all the posts gathered...
    function handleSlice(slice){
        if(slice.empty){
            db.close();
            return "sliceCount"+sliceCount;
        }

        printSlice(slice);

        //children = children.concat(slice.children);
        sliceCount++;
        return slice.next().then(handleSlice); //recurse until next slice is empty

    }

    reddit('/r/aBraThatFits/top').listing({
        t:'year'
    }).then(handleSlice)
}



function getMoreComments(linkId, childrenIds){


    var sliceCount = 0;
    function handleSlice(slice, err){
        //console.log("ERROR:  ", err);
        //console.log("SLICE:  ", slice);
        sliceCount++;
        if(slice.empty){
            db.close();
            res.send('sliceCount: '+ sliceCount);
            return true;
        }
        //iterate through the response:
        slice.json.data.things.forEach(function(comment, cI){
            var commentBody = comment.data.body;
            console.log('handling more comments: ', commentBody);
            if(commentBody == null || commentBody == "null"){
                console.log("comment body is null, here's the data : ", comment.data);
            }
            var chi = comment;
            db.collection('commentsToLinks', function(error,collection){

                var replyCount = 0;
                if(chi.data.replies !== ''){
                    replyCount = chi.data.replies.data.children.length;
                    console.log(chi.data.id + " comment has " + replyCount + " replies");
                }
                var entry = {
                    link_id: chi.data.parent_id,
                    comment_id: chi.data.id,
                    comment_text: commentBody,
                    author:chi.data.author,
                    ups: chi.data.ups,
                    downs: chi.data.downs,
                    replyCount: replyCount
                };
                console.log('(more) entry about to be saved: ', entry);
                collection.insert(entry, function(err,res){
                    if(err){
                        console.log("ERROR: ", err);
                    }
                });

            });


           //
           //console.log("index of comments in slice "+sliceCount+": "+cI+", data: ");
           // console.log("comment id: ",comment.data.id);
           // console.log("comment body: ",comment.data.body);
           // console.log("comment parent_id: ",comment.data.parent_id);
        });
        //saveComments(slice);

        //return slice.next().then(handleSlice); //recurse until next slice is empty

    }

     reddit('/api/morechildren').get({link_id:linkId , children:childrenIds.join()}).then(handleSlice);

}
function saveComments(slice){
    //slice contains comments of article from ldaComments.

    slice.forEach(function(child,index){

        //skipping the first child (which contains the article data somehow...)...
        //we iterate through the slice examining each comment.

            //skip index 0 because that's the post itself.

        child.data.children.forEach(function(chi,ind){
            console.log('this comment '+ ind +' is of type: ', chi.kind);
            var commentBody;
            var save = false;
                if(chi.data.hasOwnProperty('replies')){
                    save = true;
                    //console.log("REPLIES' IDS: ");
                    var replies = chi.data.replies;
                        //if there are replies to be examined:
                    if(replies !== ""){

                        //console.log("replies.data::::", replies.data);
                        //right now, we don't need to examine the replies...
                        //replies.data.children.forEach(function(reply, rIndex){
                        //    console.log("REPLY : ", reply.data.id + " ... " + reply.data.body);
                        //
                        //    if(reply.data.body == undefined){
                        //        console.log("reply.data: ", reply.data);
                        //    }
                        //});
                    }else{
                        //no replies, so this comment should be saved as is.

                    }
                    commentBody = chi.data.body;
                    if(commentBody==null || commentBody=='null'){
                        console.log('commentBody is null, heres the chi.data:', chi.kind);
                    }
                }else{
                    //if comment doesn't have a 'replies' field, that means it's a link to 'MORE'

                    if(chi.kind == 'more'){

                        //child.data.children.forEach(function(anotherComment, ind){
                        //   getMoreComments(anotherComment.data.link_id, chi.data.children);
                        //});

                        getMoreComments(child.data.children[0].data.link_id, chi.data.children);
                        save = false;
                    }else{
                        save = false;
                        console.log("neither a comment with replies nor a 'more' entry -- type: ", chi.kind);
                    }


                }
                if(save){
                    db.collection('commentsToLinks', function(error,collection){

                        var replyCount = 0;
                        if(chi.data.replies !== ''){
                            console.log("replies : " ,chi.data.replies);
                            replyCount = chi.data.replies.data.children.length;
                            console.log(chi.data.id + " comment has " + replyCount + " replies");
                        }
                        var entry = {
                            link_id: chi.data.parent_id,
                            comment_id: chi.data.id,
                            comment_text: commentBody,
                            author:chi.data.author,
                            ups: chi.data.ups,
                            downs: chi.data.downs,
                            replyCount: replyCount
                        };
                        console.log("saving comment: " +  entry.comment_id +  "of link: " + entry.link_id);
                        collection.insert(entry, function(err,res){
                            if(err){
                                console.log("ERROR: ", err);
                            }
                        });

                    });
                }
                //save regardless of comments to the comment.


        });


    });
}

exports.ldaComments = function(req,res){
    //for each link, get the comments and save them
    db.collection("posts_year", function(error, posts){
        posts.find({}).toArray(function(error,postArr){
            //get id
            postArr.forEach(function(post,pIndex){
                var idInQuestion = post.id;
                console.log("we're now exploring comments of this post ID: ", idInQuestion);

                function handleSlice(slice, err){
                    //slice contains the comments of the given article
                    if(slice.empty){
                        db.close();
                        res.send('DONE');
                        return "sliceCount"+sliceCount;
                    }

                    saveComments(slice);

                    //return slice.next().then(handleSlice); //recurse until next slice is empty

                }
                setTimeout(function(){
                    reddit('/r/$subreddit/comments/$article').get({$subreddit:"aBraThatFits", $article:idInQuestion, depth:8, sort:'top', limit:10}).done(handleSlice);
                },2000*pIndex);


            });

        });
    });
};


//This function retrieves comments given a parent id and a list of comment ids (ideal for grabbing the replies to a comment since it comes prepped as a list.
function getCommentsFromIdList(linkId, childrenIds, callback){

    var finalCommentsList = {name:linkId, children:[]};
    function handleSlice(slice, err, callback){

        var sentimentAnalysis = require('sentiment-analysis');
        var lda = require('lda');
        //iterate through the response:
        slice.json.data.things.forEach(function(comment, cI){
            var commentInfo = comment.data;
            var commentBody = comment.data.body;
            if(commentBody == null || commentBody == "null"){
                console.log("comment body is null, here's the data : ", comment.data);
            }

            var sentences = ldaUtils.extractSentences(commentBody);
            var topics = lda(sentences, 2,5);

            var sentimentScore = sentimentAnalysis(commentBody);

            if(comment.kind !== 't1'){
                console.log('comment '+comment.data.name+' not a comment, kind: ' + comment.kind);
            }else{
                var replies = '';
                if(commentInfo.replies == ''){
                }else{

                    replies = commentInfo.replies.data.children.length;
                }
                var commentData = {
                    link_id: commentInfo.link_id,
                    comment_id: commentInfo.id,
                    kind:comment.kind,
                    title_topics:topics,
                    reply_count:replies,
                    sentiment:sentimentScore,
                    ups:commentInfo.ups,
                    downs:commentInfo.downs,
                    children:commentInfo.replies
                };
                finalCommentsList.children.push(commentData);
            }

        });

        callback(finalCommentsList);
    }

    reddit('/api/morechildren').get({link_id:linkId , children:childrenIds.join()}).done(function(slice,error){
        handleSlice(slice, error, function(data){
            callback(data);
        })
    });

}

//[ 'de8ju49', 'de8du52' ]

exports.getRepliesToComment = function(req,res){
    var data = req.body;
    console.log(data);
    console.log(typeof data);
    var linkId = data.linkId;
    console.log("link id: ", linkId);
    var comments = data.comments;
    console.log("comments: ", comments);
    getCommentsFromIdList(linkId,comments, function(list){
        res.send(list);
    });
};


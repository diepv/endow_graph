/**
 * Created by viviandiep on 3/10/17.
 */
var lda = require('lda');
var natural = require('natural');
var ldaUtils = require(__dirname + '/ldaUtils');

var mongo = require('mongodb');
var Server = mongo.Server;
var db;
BSON = mongo.BSONPure;
var config = require('../config/config')

mongo.MongoClient.connect(config.MONGODB_URI, function(err, database) {
    if (err) {
        console.log(err);
        process.exit(1);
    }

    db = database;



});

    function extractNouns(sentences) {
        var base_folder = __dirname.replace("/routes", "") + "/node_modules/natural/lib/natural/brill_pos_tagger";
        var rulesFilename = base_folder + "/data/English/tr_from_posjs.txt";
        var lexiconFilename = base_folder + "/data/English/lexicon_from_posjs.json";
        var defaultCategory = 'N';

        var lexicon = new natural.Lexicon(lexiconFilename, defaultCategory);
        var rules = new natural.RuleSet(rulesFilename);
        var tagger = new natural.BrillPOSTagger(lexicon, rules);
        var words = [];
        sentences.forEach(function (sentence, index) {
            //split sentence up into words

            var tokenizer = new natural.WordTokenizer();
            var sentArr = tokenizer.tokenize(sentence);
            var tags = tagger.tag(sentArr);
            console.log(tags);
        });

        /*
         *
         * AT = article, HVD = had, IN = preposition, MD = modal,
         * NN = sing. noun, NP = proper noun, PPS = 3rd sing. nom.
         * pronoun, PPO = obj. personal pronoun, TO = infinitive to, VB
         * = verb, VBN = past part. verb, VBD = past verb.
         * */
    }

    exports.lda = function () {
        db.collection("posts_year", function (error, collection) {
            db.collection("topics_year_list", function (tError, tCollection) {
                collection.find().toArray(function (err, data) {
                    data.forEach(function (entry, index) {
                        var textblock = entry.selftext;
                        if (textblock.length > 0) {
                            var sentences = textblock.match(/[^\.!\?]+[\.!\?]+/g);
                            //var nouns = extractNouns(sentences);
                        }
                        var topics = lda(sentences, 2, 5); //2 topics, 5 terms each
                        topics.forEach(function (terms, num) {
                            terms.forEach(function (term, termIndex) {
                                //term.term = natural.PorterStemmer.stem(term.term);
                                tCollection.insert({term: term.term}, function (error, results) {
                                    if (error) {
                                        console.log("data insert error, term: ", term.term);
                                        console.log("error: ", error);
                                    }
                                });

                            });
                        });
                    });
                });
            });
        });
    };

    exports.ldaCount = function () {

        db.collection("topics_year_list").aggregate([
            {
                $group: {
                    _id: {term: "$term"},
                    uniqueIds: {$addToSet: "$_id"},
                    count: {$sum: 1}
                }
            },
            {
                $match: {
                    count: {$gte: 2}
                }
            },
            {$sort: {count: -1}}
        ], function (err, result) {
            db.collection("topics_year_agg", function (er, collection) {
                collection.insert(result);
            });
        })
    };

    exports.commentsAgg = function (req, res) {

        db.collection("commentsToLinks", function (err, collection) {

            collection.find({}).toArray(function (error, allComments) {
                var allCommentsCount = allComments.length;
                console.log(allCommentsCount);
                //for each comment in commentsToLinks, we examine if it exists in comments_agg. If not, add. else, ignore and move on.
                function addUnique(arrayIndex) {
                    var comment = allComments[arrayIndex];
                    var nextIndex = arrayIndex + 1;
                    console.log('next Index;', nextIndex);
                    db.collection('comments_year_agg', function (caError, caCollection) {

                        caCollection.count({
                            comment_id: comment.comment_id,
                            link_id: comment.link_id,
                            comment_text: comment.comment_text
                        }, function (countErr, duplicateCount) {
                            //console.log("duplicate count: ",duplicateCount);
                            if (duplicateCount == 0) {
                                caCollection.insert(comment);
                            }
                            if (nextIndex < allCommentsCount) {
                                addUnique(nextIndex);
                            } else {
                                return;
                            }

                        });

                    });
                }

                addUnique(0);


            });

        });
    };

    function eliminateDuplicates(topics, callback) {
        var culled = [];
        console.log('topics length: ', topics.length);
        topics.forEach(function (topic, topicIndex) {
            if (culled.length > 0) {
                var addTopic = true;
                culled.forEach(function (ctopic, ctopicIndex) {
                    if (ctopic.topic == topic) {
                        var nCount = ctopic.count + 1;
                        ctopic.count = nCount;
                        addTopic = false;
                    }
                });
                if (addTopic) {
                    culled.push({topic: topic, count: 1});
                }
            } else {
                culled.push({topic: topic, count: 1});
            }
        });
        callback(culled);
        //var culled = topics.map(function(topic){
        //    return {count: 1, topic: topic}
        //}).reduce(function(a,b){
        //    a[b.topic] = (a[b.topic] || 0) + b.count;
        //    return a;
        //}, {});
        //
        //var sorted = Object.keys(culled).sort(function(a,b){culled[a] < culled[b]});
        //
        //return sorted;
    }


    function getTfidf(comments) {
        var Tfidf = natural.TfIdf;
        var tfidf = new Tfidf();

        comments.forEach(function (comment, index) {
            var commentWords = comment.join();
            tfidf.addDocument(commentWords);
        });

        var s = JSON.stringify(tfidf);
        console.log("S:  ");
        console.log(s);
        //tfidf.listTerms().forEach(function(item){
        //   //console.log(item.term + " : "+ item.tfidf);
        //});

    }

//getCommentsByKeyword will return a file of the name of the keyword.
// This file contains a list of the topics extracted from all comments that contain the keyword (not stemmed)
    exports.getCommentsByKeyword = function (req, res) {
        //keyword should be in all its forms(?)
        var searchTerm = req.params.query;
        console.log("search term: ", searchTerm);
        db.collection("comments_year_agg", function (err, collection) {
            collection.find({"$text": {"$search": req.params.query}}, {
                "comment_id": 1,
                "ups": 1,
                "reply_count": 1,
                "comment_text": 1,
                "textScore": {"$meta": "textScore"}
            }, {"sort": {"textScore": {"$meta": "textScore"}}}).toArray(function (err, arr) {
                var topicsList = [];
                var allSentences = [];
                arr.forEach(function (comment, cIndex) {
                    var sentences = comment.comment_text.match(/[^\.!\?]+[\.!\?]+/g);
                    allSentences.push(sentences);
                    var topics = lda(sentences, 2, 5);
                    topics.forEach(function (topicSet, ind) {
                        //var terms = [];
                        topicSet.forEach(function (term, tIndex) {
                            topicsList.push(term.term);
                        });
                    });
                });
                getTfidf(allSentences);

                eliminateDuplicates(topicsList, function (culled) {
                    var converter = require('json-2-csv');
                    //console.log('culled:' ,culled);
                    converter.json2csv(culled, function (err, csv) {
                        var fs = require('fs');
                        fs.writeFile(searchTerm + ".csv", csv, function (err) {
                            if (err) {
                                console.log("ERROR: ", err);
                            } else {
                                res.send("DONE - check for file: " + searchTerm + ".csv");
                            }
                        });
                    });
                });


            });
        });
    };


//getThreadsByKeyword will return data on each thread's full text including all comments and replies that contains the given keyword
// for each thread, data returned are:
// (1) list of topics by their count (# of times topic came up when reviewing each comment/reply)
// (2) # of 1st level replies/comments
// (3) overall sentiment? or reply-level sentiment?
function newTopic(topicArray, topicsList) {
    //console.log('received: ', topicArray);
    if(typeof topicArray !== "undefined"){
        topicArray.forEach(function (topic, topicIndex) {
            var addToTopicsList = true;
            if (topicsList.length > 0) {

                topicsList.forEach(function (topicObject, index) {
                    if (topicObject.topic == topic.term) {
                        var newCount = topicObject.count + 1;
                        topicObject.count = newCount;
                        addToTopicsList = false;
                    }
                });

            }
            if (addToTopicsList == true) {

                //then add it to topicsList
                var newTopic = {topic: topic.term, count: 1};
                topicsList.push(newTopic);
            }
        });

    }
    return topicsList;
}

function checkPostsFor(term,posts,sourceId,callback){
    var linksTo = [];
    posts.forEach(function(post, postIndex){
        if(post.topics.length>0){
            post.topics.forEach(function(topic, tIndex){

                if(topic.topic == term && post.name !== sourceId){
                    linksTo.push({target: post.name, source:sourceId, value:topic.topic});
                }
            });
        }
    });

    callback(linksTo);
}


function formatIntoLinksAndNodes(data, callback){
    //nodes are posts and links are shared topics
    var nodes = [];
    var links = [];
    data.children.forEach(function(post, postIndex){
        if (post.topics.length>0){
            post.topics.forEach(function(topic, topicSetIndex){
                //post.topics is the aggregated array of topics of title + selftext. check if it has any matches with other posts in the data array
                var searchTerm = topic.topic;
                checkPostsFor(searchTerm, data.children, post.name, function(idArrayOfMatches){

                    if(idArrayOfMatches.length>0){
                        links = links.concat(idArrayOfMatches);
                    }
                });
            });
        }
        nodes.push(post);
    });
    callback({nodes:nodes, links:links});
}

function formatIntoTopicNodesAndLinks(data, finalCallback){
    console.log("inside formatIntoTopicNodesAndLinks");
    //nodes are topics - they should contain the topic name and full count of # of posts it is a topic in (should match links)
    var nodes = [];
    var links = [];
    //var justTopics = [];


    data.children.forEach(function(post, postIndex){
        //for each post, we grab the list of topics. for each topic, we create a node if it doesn't exist or we add our post.name to the list if it does exist.
        var postTopics = post.topics;
        postTopics.forEach(function(topicData, topicDataIndex) {
            //if(justTopics.indexOf(topicData.topic)>-1){
            //    //find the entry in nodes with this topic and add to the postIds.
            //}
            var pushNewNode = true;
            nodes.forEach(function(node,nindex){
                if(node.name === topicData.topic){
                    node.postIds.push(post.name);
                    pushNewNode = false;
                }

            });
            if(pushNewNode){
                nodes.push({name: topicData.topic, postIds: [post.name]});
            }

        });

        //while in each post, we also create links between each and every topic and concat that list with the official links array.
        postTopics.forEach(function(topicData, topicDataIndex){
           postTopics.forEach(function(topicToLink, topicToLinkIndex){
               var newLink;
               var pushNewLink = true;
               links.forEach(function(link, lIndex){
                   if(link.source == topicData.topic || link.target == topicData.topic){
                       if(link.source == topicToLink.topic || link.target == topicToLink.topic){
                           if(link.postIds.indexOf(post.name)>-1){

                           }else{
                               link.postIds.push(post.name);
                           }
                           pushNewLink = false;
                       }
                   }
               });
               if(pushNewLink){
                   newLink = {source:topicData.topic, target: topicToLink.topic, postIds: [post.name]};
                   links.push(newLink);
               }




           }) ;
        });
    });


    console.log("NODES LENGTH: ",nodes.length);
    console.log("LINKS LENGTH: ",links.length);
    finalCallback({nodes:nodes, links:links, posts:data.children});

}


exports.getThreadsByKeyword = function (req, res) {
        var queryTerm = req.params.query;
        var linksAndNodes = req.params.linkNodeStructure;
        var sentimentAnalysis = require('sentiment-analysis');



        function getSentimentScore(text) {
            var score = sentimentAnalysis(text);
            return score;
        }

        function processCommentsOfPost(postID, callback) {

            //look for comments with the matching link id and process each comment for a list of topics + counts
            //while looking at each comment, determine sentiment
            //add topics to the ultimate topics list with the correct count

            db.collection('comments_year_agg', function (error, allComments) {
                allComments.find({"link_id": postID}).toArray(function (err, comments) {
                    if (!err) {
                        var allCommentsTopics = [];
                        var allCommentsData = [];
                        comments.forEach(function (comment, cIndex) {
                            //1.get topics
                            if(comment.comment_text!=='' && comment.comment_text!==null){
                                var sentences = ldaUtils.extractSentences(comment.comment_text);
                                var topics = lda(sentences, 2, 5);
                                var topicsUnique = newTopic(topics, []);
                                if(topics == undefined || topics == 'undefined' || topics == '' || topics.length == 0){

                                }else{

                                    allCommentsTopics = newTopic(topics, allCommentsTopics);
                                    //2. get sentiment
                                    var sentimentScore = getSentimentScore(comment.comment_text);

                                    var commentData = {
                                        topics: topicsUnique,
                                        kind:'comment',
                                        kind_type: 't1',
                                        name:comment.comment_id,
                                        comment_text:comment.comment_text,
                                        comment_id: comment.comment_id,
                                        link_id: comment.link_id,
                                        reply_count: comment.replyCount,
                                        sentiment: sentimentScore,
                                        ups: comment.ups,
                                        downs: comment.downs,
                                        topics: topics
                                    };
                                    allCommentsData.push(commentData);
                                }

                            }
                        });

                        callback({'all_comments_data': allCommentsData, 'all_comments_topic': allCommentsTopics});

                    }
                });
            })
        }

        var allThreads = [];

        db.collection('posts_year', function (error, allPosts) {
            if (error) {
                console.log("error in getting posts collection: ", error);
            } else {
                allPosts.find({"$text": {"$search": req.params.query}}, {
                    "name": 1,
                    "selftext": 1,
                    "title": 1,
                    "num_comments": 1,
                    "ups": 1,
                    "downs": 1,
                    "textScore": {"$meta": "textScore"}
                }, {"sort": {"textScore": {"$meta": "textScore"}}}).toArray(function (err, arr) {
                    if (err) {
                        console.log("ERROR: ", err);
                    } else {
                        console.log('returned array of length: ', arr.length);

                        var dataOfPosts = {name: "posts", children: []};
                        var postCount = 0;

                        function iteratePosts(post, postIndex) {
                            //arr.forEach(function(post, postIndex){
                            var postData = {
                                name: post.name,
                                kind:'post',
                                kind_code: 't3',
                                title: post.title,
                                title_topics: [],
                                self_text: post.selftext,
                                text_topics:[],
                                topics:[],
                                reply_count: post.num_comments,
                                sentiment: '',
                                ups: post.ups,
                                downs: post.downs,
                                children: [],
                                replies_topics: []
                            };
                            var topicsList = [];

                            //for each post, we want to process title and any selftext if it exists and get the topics list from it.

                            var postTitle = post.title;
                            var postText = post.selftext;
                            var postID = post.name;

                            //get topics of the self text:
                            if (postText.length > 1) {
                                var selfTextSentences = postText.match(/[^\.!\?]+[\.!\?]+/g);
                                var selfTextTopics = lda(selfTextSentences, 1, 5);
                                topicsList = newTopic(selfTextTopics[0], topicsList);
                                postData.text_topics = topicsList;
                            }

                            //get topics of the TITLE
                            if (postTitle.length > 1) {
                                var titleBreakdown = ldaUtils.extractSentences(postTitle);
                                var titleTopics = lda(titleBreakdown, 1, 3);
                                topicsList = newTopic(titleTopics[0], topicsList);
                                postData.title_topics = titleTopics;
                            }

                            postData.topics = topicsList;

                            postData.sentiment = getSentimentScore(postTitle);
                            //look for comments with the matching link id and process each comment for a list of topics + counts
                            //while looking at each comment, determine sentiment. add a point to either 'good' or 'bad' sentiment count
                            //add topics to the ultimate topics list with the correct count
                            processCommentsOfPost(postID, function (data) {
                                postData.replies_topics = data.all_comments_topic;
                                postData.children = data.all_comments_data;
                                dataOfPosts.children.push(postData);

                                postCount++;
                                console.log('arr.length: ', arr.length);
                                if (arr.length == 0) {
                                    console.log('linksAndNodes: ', linksAndNodes);
                                    switch(linksAndNodes){
                                        case "0":
                                            console.log("about to summon formatIntoLinksAndNodes");
                                            formatIntoLinksAndNodes(dataOfPosts, function(linksAndNodes){
                                                res.send(linksAndNodes);
                                            });
                                            break;
                                        case "1":
                                            console.log("about to summon formatIntoTopic");
                                            formatIntoTopicNodesAndLinks(dataOfPosts, function(linksNodesByTopic){
                                                res.send(linksNodesByTopic);
                                            });
                                            break;
                                    }
                                } else {
                                    iteratePosts(arr.pop(), postCount);
                                }
                            });


                            //});

                        }
                        if(arr.length>0){
                            iteratePosts(arr.pop(), postCount);
                        }else{

                            res.send('none matching query: ' + req.params.query);
                        }

                    }

                });

            }

        });

    };

exports.formatCommentsIntoNodesAndLinks = function(req,res){
    var bodyData = JSON.parse(req.body);
    var commentsArray = bodyData.comments;
    var mode = bodyData.node_mode;
    switch(mode){
        case "posts":
            //postsAsNodes(commentsArray, function(data){
            //   res.send(data);
            //});
            break;
        case "topics":
            //topicsAsNodes(commentsArray, function(data){
            //    res.send(data);
            //});
            break;
    }
    res.send("DONE");
    function postsAsNodes(commentsArray, callback){
        var nodes = [];
        var links = [];
        commentsArray.forEach(function(comment, ci){
            //add comment to nodes list.
            nodes.push(comment);
            var refTopics = []; // refTopics is a list of all the topics within this particular comment
            comment.topics.forEach(function(topicEntry, teI){
                //add each topic in this comment to the ref topics.
                if(refTopics.indexOf(topicEntry.topic)<0){
                    refTopics.push(topicEntry.topic);
                }

            });

            //for each comment AFTER this one, we examine the topics and determine if any of them match our current post's topics.
            //if there's a match, a link is created.
            for(var commentIndex = ci+1; commentIndex<commentsArray.length; commentIndex++) {
                //for each comment after the one we're inspecting, create links if topics match one of the topics in reftopics.
                var commentInQuestion = commentsArray[commentIndex];
                commentInQuestion.topics.forEach(function(commentInQuestionTopic, ciqti){
                    var posInRefTopics = refTopics.indexOf(commentInQuestionTopic.topic);
                    if(posInRefTopics>-1){
                        var newLink = {source:comment.name, target:commentInQuestion.name, value: commentInQuestionTopic.topic};
                        links.push(newLink);
                    }
                });
            }
        });
        callback({nodes:nodes, links:links});
    }

    function topicsAsNodes(commentsArray, callback){
        var nodes = [];
        var links = [];
        var topicsAddedAsNodes = [];

        commentsArray.forEach(function(comment, ci){
            //for each comment, we get the topic list and create a node of each topic. if a node already exists, add comment.name to the postIds list.
            comment.topics.forEach(function(cTopic, cti){
                if(topicsAddedAsNodes.indexOf(cTopic.topic)<0){
                    var newNode = {name: cTopic.topic, postIds:[comment.name]};
                    nodes.push(newNode);
                }
                //create a link with each topic followwing. if link already exists, add comment.name to post id:
                for(var followingTopicIndex = cti+1; followingTopicIndex<comment.topics.length; followingTopicIndex++){
                    var followingTopic = comment.topics[followingTopicIndex];
                    links.forEach(function(link, li){
                        var makeLink = true;
                        if(link.source == cTopic.topic || link.target == cTopic.topic){
                            if(link.source == followingTopic.topic || link.target == followingTopic.topic){
                                //link exists, just add to postIds:
                                link.postIds.push(comment.name);
                                makeLink= false;
                            }
                        }
                        if(makeLink){
                            var newLink = {source:cTopic.topic, target:followingTopic.topic};
                            links.push(newLink);
                        }
                    });
                }
            });

        });
        callback({nodes:nodes, links:links, posts:commentsArray});

    }

};
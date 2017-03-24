/**
 * Created by viviandiep on 3/21/17.
 */

exports.extractSentences = function(textBlock){
    var sentences = textBlock.match( /[^\.!\?]+[\.!\?]+/g );
    return sentences;
};
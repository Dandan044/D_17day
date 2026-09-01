import { registerTree } from '../../t';

export const data = {
  "hook_echo_sliceflags": {
    "_shared": {
      "title": "洗手的时候你想起来一件事",
      "body": "水流过指缝。你忽然想起自己做过的那个选择——哪一天想不起来了，只记得选完那天，你手上还沾着别的东西。\n没人跟你提过这件事。你关了水，手还是湿的。",
      "choice": {
        "ack": {
          "label": "关水，把当时的选择再过一遍",
          "log": "你关了水。把当时怎么选的又想了一遍，然后接着干活。"
        },
        "skip": {
          "label": "什么都不做",
          "log": "你没停。搓完手就去数罐头，那件事暂时没再来。"
        }
      }
    }
  }
};

registerTree('event', data);

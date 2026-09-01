import { registerTree } from '../../t';

export const data = {
  "med_flu_blood_cough": {
    "main": {
      "title": "咳嗽带血",
      "body": "手背上一小点红。你咳完才看见。\n烧还没退。药匣里还剩几板。",
      "choice": {
        "meds": {
          "label": "按疗程吃药",
          "log": "你把两板药吃完。夜里咳得少了。"
        },
        "endure": {
          "label": "硬扛",
          "log": "你把痰吐进纸里，纸扔进垃圾袋。烧还在。"
        },
        "skip": {
          "label": "什么都不做",
          "log": "你躺下，把灯关了。"
        }
      }
    }
  },
  "med_wound_line": {
    "main": {
      "title": "红线又往上了",
      "body": "早上量到手腕上方，现在快到肘。\n伤口本身不太疼了。这不是好消息。",
      "choice": {
        "treat": {
          "label": "用药清创",
          "reason": "需要 1 级医疗站",
          "log": "你清了创，包扎。红线停了一点。"
        },
        "meds_only": {
          "label": "只吃药",
          "log": "药吃了。红线还在，只是慢了一点。"
        },
        "skip": {
          "label": "什么都不做",
          "log": "你把袖子拉下来，不想再看。"
        }
      }
    }
  },
  "med_recycle_flank": {
    "main": {
      "title": "腰眼两边疼",
      "body": "蹲下接水时，两侧腰眼抽了一下。\n尿色比昨天深。回用喝了不少天。",
      "choice": {
        "stop_recycle": {
          "label": "今天停回用，改限水",
          "log": "你把回用的壶推开。喉咙干，腰还是胀。"
        },
        "meds": {
          "label": "吃药顶一下",
          "log": "药下去了。疼淡了一点，水还是回用的。"
        },
        "skip": {
          "label": "什么都不做",
          "log": "你站直，假装没事。"
        }
      }
    }
  },
  "med_eyes_yellow": {
    "main": {
      "title": "镜子里眼白发黄",
      "body": "你刷牙时抬眼看镜子。眼白不是白的。\n皮肤也跟着一点黄。嘴里有金属味。",
      "choice": {
        "treat": {
          "label": "按黄疸用药",
          "reason": "需要 2 级医疗站",
          "log": "你按说明吃了疗程。眼睛还黄，人能站直一点。"
        },
        "wait": {
          "label": "再观察两天",
          "log": "你把镜子转过去。黄还在眼角余光里。"
        },
        "skip": {
          "label": "什么都不做",
          "log": "你关掉灯，不去看。"
        }
      }
    }
  }
};

registerTree('event', data);

// Character voice lines per sprite

export var CHARACTERS = {
  tabby_cat: { defaultName: 'Phoebe', displayName: 'Tabby Cat' },
  blue_buddy: { defaultName: 'Buddy', displayName: 'Blue Buddy' },
  coco: { defaultName: 'Coco', displayName: 'Coco' },
  golden_retriever: { defaultName: 'Cooper', displayName: 'Golden Retriever' },
  schnauzer: { defaultName: 'Pepper', displayName: 'Schnauzer' },
  tuxedo_cat: { defaultName: 'Luna', displayName: 'Tuxedo Cat' },
  _default: { defaultName: 'Phoebe' },
};

export var VOICE = {
  tabby_cat: {
    greet: '🐱',
    acks: ['~♪', '😊', 'hehe', 'meow!', '💛'],
    petHold: 'purrrr~ 😊',
    petLines: ['purrrr~', 'more...', 'mmm~ 😊', "don't stop~"],
    petFallback: 'purrrr~ 😊',
    tapLines: ['hm?', '!', 'meow?', '~'],
    tapFallback: 'meow?',
    chatFallback: 'meow?',
  },
  blue_buddy: {
    greet: '👋',
    acks: ['~♪', '😊', 'hehe', 'yo!', '💙'],
    petHold: 'hehe that tickles~ 😊',
    petLines: ['hehe~', 'more...', 'feels nice~ 😊', "don't stop~"],
    petFallback: 'hehe~ 😊',
    tapLines: ['hm?', '!', 'hey?', '~'],
    tapFallback: 'hey?',
    chatFallback: 'hmm?',
  },
  coco: {
    greet: '🐶',
    acks: ['~♪', '😊', 'hehe', 'woof!', '🩷'],
    petHold: 'tail wagging intensifies~ 😊',
    petLines: ['more pets~', 'play with me?', 'best day ever~ 😊', "don't stop~"],
    petFallback: '*happy panting* 😊',
    tapLines: ['hm?', '!', 'woof?', '~'],
    tapFallback: 'woof?',
    chatFallback: 'woof?',
  },
  golden_retriever: {
    greet: '🐶',
    acks: ['~♪', '😊', 'hehe', 'woof!', '💛'],
    petHold: 'tail wagging intensifies~ 😊',
    petLines: ['more pets~', 'best day ever~', 'so happy~ 😊', "don't stop~"],
    petFallback: '*happy panting* 😊',
    tapLines: ['hm?', '!', 'woof?', '~'],
    tapFallback: 'woof?',
    chatFallback: 'woof?',
  },
  schnauzer: {
    greet: '🐶',
    acks: ['~♪', '😊', 'hehe', 'arf!', '🖤'],
    petHold: 'hmph... fine, keep going~ 😊',
    petLines: ['...okay that\'s nice', 'hmph~', 'don\'t tell anyone~ 😊', 'more...'],
    petFallback: 'hmph~ 😊',
    tapLines: ['hm?', '!', 'arf?', '~'],
    tapFallback: 'arf?',
    chatFallback: 'arf?',
  },
  tuxedo_cat: {
    greet: '🐱',
    acks: ['~♪', '😊', 'mew~', 'nya!', '🩶'],
    petHold: 'purrrr~ 😊',
    petLines: ['purrrr~', 'more...', 'mmm~ 😊', "don't stop~"],
    petFallback: 'purrrr~ 😊',
    tapLines: ['hm?', '!', 'mew?', '~'],
    tapFallback: 'mew?',
    chatFallback: 'mew?',
  },
  _default: {
    greet: '👋',
    acks: ['~♪', '😊', 'hehe', 'hey!', '💛'],
    petHold: 'hehe~ 😊',
    petLines: ['hehe~', 'more...', 'nice~ 😊', "don't stop~"],
    petFallback: 'hehe~ 😊',
    tapLines: ['hm?', '!', 'hey?', '~'],
    tapFallback: 'hey?',
    chatFallback: 'hmm?',
  }
};

// pet.currentSprite must be set before calling
export function voice(pet) { return VOICE[pet.currentSprite] || VOICE._default; }

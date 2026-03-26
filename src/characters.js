// Character voice lines per sprite

export var CHARACTERS = {
  tabby_cat: { defaultName: 'Mochi', species: 'Cat' },
  blue_buddy: { defaultName: 'Buddy', species: 'Buddy' },
  golden_retriever: { defaultName: 'Cooper', species: 'Dog' },
  _default: { defaultName: 'Mochi', species: 'Pet' },
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

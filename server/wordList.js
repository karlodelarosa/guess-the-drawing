/** Predefined word lists organized by category. */

const WORDS = {
  Animals: [
    'elephant', 'giraffe', 'penguin', 'dolphin', 'kangaroo',
    'octopus', 'butterfly', 'crocodile', 'hedgehog', 'flamingo',
    'peacock', 'squirrel', 'turtle', 'whale', 'zebra',
    'parrot', 'hamster', 'lobster', 'moose', 'panda',
  ],
  Objects: [
    'umbrella', 'telescope', 'backpack', 'lighthouse', 'compass',
    'hourglass', 'typewriter', 'microscope', 'chandelier', 'suitcase',
    'bicycle', 'camera', 'globe', 'ladder', 'mailbox',
    'paintbrush', 'scissors', 'trophy', 'violin', 'wheelchair',
  ],
  Food: [
    'pizza', 'sushi', 'pancake', 'watermelon', 'croissant',
    'taco', 'donut', 'pretzel', 'avocado', 'cupcake',
    'hamburger', 'noodles', 'popcorn', 'sandwich', 'strawberry',
    'pineapple', 'burrito', 'waffle', 'coconut', 'muffin',
  ],
  Bible: [
    'ark', 'cross', 'dove', 'manna', 'shepherd',
    'temple', 'scroll', 'lamb', 'vineyard', 'olive branch',
    'burning bush', 'rainbow', 'crown', 'scroll', 'lampstand',
    'harp', 'scroll', 'pillar', 'altar', 'scroll',
  ],
  Church: [
    'steeple', 'pew', 'hymn', 'communion', 'baptism',
    'choir', 'sermon', 'offering', 'fellowship', 'prayer',
    'candle', 'bell', 'organ', 'stained glass', 'pulpit',
    'sanctuary', 'vestments', 'processional', 'alleluia', 'amen',
  ],
  Music: [
    'guitar', 'piano', 'drums', 'trumpet', 'violin',
    'saxophone', 'flute', 'harp', 'trombone', 'cello',
    'microphone', 'headphones', 'metronome', 'conductor', 'orchestra',
    'karaoke', 'turntable', 'accordion', 'banjo', 'ukulele',
  ],
};

/**
 * Pick a random word from all categories.
 * @returns {{ word: string, category: string }}
 */
function getRandomWord() {
  const categories = Object.keys(WORDS);
  const category = categories[Math.floor(Math.random() * categories.length)];
  const list = WORDS[category];
  const word = list[Math.floor(Math.random() * list.length)];
  return { word, category };
}

module.exports = { WORDS, getRandomWord };

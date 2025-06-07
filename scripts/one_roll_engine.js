const HOOK_CLICK_SET = 'one-roll-engine clickSet'
const HOOK_CLICK_LOOSE_DIE = 'one-roll-engine clickLooseDie'

/*
 * Parse and roll dice when users type `/ore 6d10` and similar syntax
 */
Hooks.on('chatMessage', (_, messageText, data) => {
  if (messageText !== undefined && messageText.startsWith(`/ore`)) {
    rollFromChatMessageOreCommand(messageText, data)
    return false
  } else {
    return true
  }
})

/*
 * Toggle dashed outline of sets, when clicked
 */
Hooks.on('renderChatLog', () => {
  const chatLog = $('#chat-log')
  chatLog.on('click', '.ore-set-roll', (event) => {
    event.preventDefault()
    const setsDiv = event.currentTarget
    if (event.ctrlKey || event.shiftKey) {
      const hookCallAnswer = Hooks.call(HOOK_CLICK_SET, event)
      if (hookCallAnswer === false) return
    }
    setsDiv.style.outline = setsDiv.style.outline === 'dashed' ? 'none' : 'dashed'
  })
  chatLog.on('click', '.ore-single-roll.loose', (event) => {
    event.preventDefault()
    const looseDieDiv = event.currentTarget
    if (event.ctrlKey || event.shiftKey) {
      const hookCallAnswer = Hooks.call(HOOK_CLICK_LOOSE_DIE, event)
      if (hookCallAnswer === false) return
    }
    if (event.altKey) {
      const startingValue = parseInt(looseDieDiv.dataset.value)
      const currentValue = parseInt(looseDieDiv.style.backgroundImage.match(/(\d+)\.png/)[1])
      let newValue = currentValue - 1
      if (newValue === 0) newValue = `loose_${startingValue}`
      looseDieDiv.style.backgroundImage = `url("systems/oresystem/images/dice/d10_${newValue}.png")`
    } else {
      looseDieDiv.style.outline = looseDieDiv.style.outline === 'dashed' ? 'none' : 'dashed'
    }
  })
})

/**
 * Show 3D dice with Dice So Nice if available
 */
const showDiceAnimation = async (roll) => {
  if (game.dice3d) {
    await game.dice3d.showForRoll(roll);
  }
}

/**
 * @param {string} messageText
 * @param {object} data
 */
const rollFromChatMessageOreCommand = async (messageText, data) => {
  let match = messageText.match(new RegExp(`^/ore (.*?)(?:\\s*#\\s*([^]+)?)?$`))
  if (!match) return errorParsingOreCommand(messageText)
  const rollPart = match[1], flavorText = match[2]
  match = rollPart.match(new RegExp(`^([0-9]+)(?:d?1?0?\\s*?)([0-9]+)?(?:\\s*)([eEhH])?(?:\\s*)(10|[1-9])?(?:\\s*)(dif)?(?:\\s*)(10|[0-9])?(?:\\s*)(pen)?(?:\\s*)(10|[0-9])?(?:\\s*)(md|MD|m|M|wd|WD|w|W)?(?:\\s*)([0-9]+)?$`))
  if (!match) return errorParsingOreCommand(messageText)
  
  const diceCount = parseInt(match[1])
  let expertCount = 0
  let expertValue = 10
  let difficulty = 0
  let penalty = 0
  let masterCount = 0
  
  if (match[3]) {
    if (match[2]) {
      expertCount = parseInt(match[2])
    } else {
      expertCount = 1
    }
    if (match[4]) {
      expertValue = parseInt(match[4])
    }
  }
  if (match[5]) {
    difficulty = parseInt(match[6]) || 0
  }
  if (match[7]) {
    penalty = parseInt(match[8]) || 0;
  }
  if (match[9]) {
    if (match[10]) {
      masterCount = parseInt(match[10], 10)
    } else {
      masterCount = 1
    }
  }
  
  console.log("Parsed values:", {diceCount, expertCount, difficulty, penalty, masterCount, expertValue});
  
  // Calculate final dice count after penalties for Dice So Nice
  let finalDiceCount = diceCount;
  let finalExpertCount = expertCount;
  let finalMasterCount = masterCount;
  let remainingPenalty = penalty;
  
  // Apply penalty to master dice first
  if (finalMasterCount > 0 && remainingPenalty > 0) {
    const penaltyToMD = Math.min(remainingPenalty, finalMasterCount);
    finalMasterCount -= penaltyToMD;
    remainingPenalty -= penaltyToMD;
  }
  
  // Then apply remaining penalty to expert dice
  if (finalExpertCount > 0 && remainingPenalty > 0) {
    const penaltyToED = Math.min(remainingPenalty, finalExpertCount);
    finalExpertCount -= penaltyToED;
    remainingPenalty -= penaltyToED;
  }
  
  // Finally, apply remaining penalty to normal dice
  if (remainingPenalty > 0) {
    finalDiceCount = Math.max(0, finalDiceCount - remainingPenalty);
  }
  
  // Create roll with final dice count for correct Dice So Nice animation
  const roll = createRawRoll(finalDiceCount);
  await roll.evaluate()
  
  const rollResult = await parseRawRoll(roll, finalExpertCount, expertValue, difficulty, 0, flavorText, finalMasterCount)
  data.content = await getContentFromRollResult(rollResult)
  data.type = CONST.CHAT_MESSAGE_TYPES.OTHER
  data.rolls = [roll]
  data.flags = { core: { canPopout: true } }
  return ChatMessage.create(data, {})
}

const errorParsingOreCommand = (messageText) => {
  ui.notifications.error(
    `<div>Failed parsing your command:</div>
    <div><p style="font-family: monospace">${messageText}</p></div>
    <div>Try instead: <p style="font-family: monospace">/ore 7d 6e9 dif 3 pen 2 m5 #blah</p></div>`,
  )
  return null
}

/**
 * returns a Foundry Roll object.
 * @param {number} diceCount
 */
const createRawRoll = (diceCount) => {
  return new Roll(`${diceCount}d10`);
}

const parseRawRoll = async (roll, expertCount, expertValue, difficulty, penalty, flavorText, masterCount) => {
  const rawRolls = roll.dice[0] ? roll.dice[0].results.map(r => r.result) : [];
  
  // Expert dice always show the expertValue, they don't roll
  let expertRolls = [];
  if (expertCount > 0) {
    expertRolls = new Array(parseInt(expertCount)).fill(parseInt(expertValue));
  }
  
  const counts = new Array(11).fill(0)  // [0, 1, ..., 9, 10].  the 0 is not used
  rawRolls.forEach(k => {
    counts[k] += 1
  })
  expertRolls.forEach(k => {
    counts[k] += 1
  })
  const sets = {}  // key = height, value = width
  const looseDice = []
  let masterDice = new Array(masterCount).fill(10)
  
  counts.forEach((count, num) => {
    if (count === 0) return  // (will also skip the "0" count)
    if (num < difficulty) return // drop dice lower than the difficulty
    if (count === 1) looseDice.push(num)
    if (count >= 2) sets[num] = count
  })
  
  return {
    rawRolls: rawRolls,
    expertRolls,
    flavorText,
    sets: Object.entries(sets)
      .map(s => [parseInt(s[0], 10), s[1]])
      .sort((s1, s2) => s1[0] - s2[0])
      .map(s => ({
        width: s[1],
        height: s[0],
        rollsInSet: new Array(s[1]).fill(s[0]),
      })),
    looseDice,
    masterDice,
  }
}

/**
 * @param {ORERollResult} rollResult
 */
const getContentFromRollResult = async (rollResult) => {
  const { sets, looseDice, flavorText, masterDice } = rollResult
  return await renderTemplate(`systems/oresystem/templates/ore-roll.html`, {
    sets, looseDice, flavorText, masterDice,
  })
}

export const ORE = {
  createRawRoll,
  parseRawRoll,
  getContentFromRollResult,
  rollFromChatMessageOreCommand,
  hooks: {
    HOOK_CLICK_SET,
    HOOK_CLICK_LOOSE_DIE,
  },
}

Hooks.on('init', () => {
  game.oneRollEngine = ORE
  console.log(`ORE | Initialized.`)
})
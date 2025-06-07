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
 * Enhanced chat interactions
 */
Hooks.on('renderChatLog', () => {
  const chatLog = $('#chat-log')
  
  // Original set and dice clicking
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

  // Results panel toggle - FIXED
  chatLog.on('click', '.results-header', (event) => {
    event.preventDefault()
    event.stopPropagation()
    const panel = event.currentTarget.closest('.ore-results-panel')
    if (panel) {
      panel.classList.toggle('expanded')
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
 * Calculate sequences from dice results
 * @param {Array} allDice - All dice values from the roll
 * @returns {Array} Array of sequence objects
 */
const calculateSequences = (allDice) => {
  const sequences = []
  const uniqueValues = [...new Set(allDice)].sort((a, b) => a - b)
  
  let currentSequence = []
  
  for (let i = 0; i < uniqueValues.length; i++) {
    const value = uniqueValues[i]
    
    if (currentSequence.length === 0 || value === currentSequence[currentSequence.length - 1] + 1) {
      currentSequence.push(value)
    } else {
      if (currentSequence.length >= 4) {
        sequences.push({
          low: currentSequence[0],
          high: currentSequence[currentSequence.length - 1],
          length: currentSequence.length,
          values: [...currentSequence]
        })
      }
      currentSequence = [value]
    }
  }
  
  if (currentSequence.length >= 4) {
    sequences.push({
      low: currentSequence[0],
      high: currentSequence[currentSequence.length - 1],
      length: currentSequence.length,
      values: [...currentSequence]
    })
  }
  
  return sequences
}

/**
 * Auto-detect weapon from flavor text
 * @param {string} flavorText - The flavor text from the roll
 * @returns {Object|null} Weapon context or null
 */
const detectWeaponContext = (flavorText) => {
  if (!flavorText) return null
  
  const speaker = ChatMessage.getSpeaker()
  if (!speaker.actor) return null
  
  const actor = game.actors.get(speaker.actor)
  if (!actor) return null
  
  // Look for weapon name in flavor text
  const weapons = actor.items.filter(i => i.type === 'weapon')
  for (const weapon of weapons) {
    if (flavorText.toLowerCase().includes(weapon.name.toLowerCase())) {
      return { weapon, name: weapon.name, id: weapon.id }
    }
  }
  
  // Check for weapon action keywords
  if (flavorText.match(/\b(attack|parry|dodge)\b/i) && weapons.length > 0) {
    return { weapon: weapons[0], name: weapons[0].name, id: weapons[0].id }
  }
  
  return null
}

/**
 * Auto-detect target from selected tokens
 * @returns {Object|null} Target context or null
 */
const getTargetContext = () => {
  const targets = Array.from(game.user.targets)
  if (targets.length === 0) return null
  
  const target = targets[0]
  if (!target.actor) return null
  
  const hitlocs = target.actor.items.filter(i => i.type === 'hitloc')
  if (hitlocs.length === 0) return null
  
  return {
    target: target,
    actor: target.actor,
    name: target.name || target.actor.name,
    hitlocs: hitlocs
  }
}

/**
 * Calculate hit locations for all sets
 * @param {Array} sets - The sets from the roll
 * @param {Object} targetContext - Target context
 * @returns {Object} Map of height -> location name
 */
const calculateHitLocations = (sets, targetContext) => {
  const results = {}
  
  if (!targetContext || !targetContext.hitlocs) return results
  
  sets.forEach(set => {
    const height = set.height
    const location = targetContext.hitlocs.find(loc => 
      height >= (loc.system.noStart || 0) && height <= (loc.system.noEnd || 0)
    )
    
    results[height] = location ? (location.system.name || location.name) : "Miss"
  })
  
  return results
}

/**
 * Calculate weapon damages for all sets
 * @param {Array} sets - The sets from the roll
 * @param {Object} weaponContext - Weapon context
 * @returns {Array} Array of damage strings
 */
const calculateWeaponDamages = (sets, weaponContext) => {
  if (!weaponContext || !weaponContext.weapon) return []
  
  return sets.map((set, index) => {
    const rollResult = { sets: [set], looseDice: [], masterDice: [] }
    
    try {
      return weaponContext.weapon.getDamageString(rollResult) || "0 damage"
    } catch (error) {
      console.error('Error calculating weapon damage:', error)
      return "Error"
    }
  })
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
  
  // Calculate final dice count after penalties
  let finalDiceCount = diceCount;
  let finalExpertCount = expertCount;
  let finalMasterCount = masterCount;
  let remainingPenalty = penalty;
  
  if (finalMasterCount > 0 && remainingPenalty > 0) {
    const penaltyToMD = Math.min(remainingPenalty, finalMasterCount);
    finalMasterCount -= penaltyToMD;
    remainingPenalty -= penaltyToMD;
  }
  
  if (finalExpertCount > 0 && remainingPenalty > 0) {
    const penaltyToED = Math.min(remainingPenalty, finalExpertCount);
    finalExpertCount -= penaltyToED;
    remainingPenalty -= penaltyToED;
  }
  
  if (remainingPenalty > 0) {
    finalDiceCount = Math.max(0, finalDiceCount - remainingPenalty);
  }
  
  const roll = createRawRoll(finalDiceCount);
  await roll.evaluate()
  
  const rollResult = await parseRawRoll(roll, finalExpertCount, expertValue, difficulty, 0, flavorText, finalMasterCount)
  data.content = await getContentFromRollResult(rollResult)
  data.rolls = [roll]
  data.flags = { core: { canPopout: true } }
  
  // Don't set style/type explicitly - let Foundry handle it
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

const createRawRoll = (diceCount) => {
  return new Roll(`${diceCount}d10`);
}

const parseRawRoll = async (roll, expertCount, expertValue, difficulty, penalty, flavorText, masterCount) => {
  const rawRolls = roll.dice[0] ? roll.dice[0].results.map(r => r.result) : [];
  
  let expertRolls = [];
  if (expertCount > 0) {
    expertRolls = new Array(parseInt(expertCount)).fill(parseInt(expertValue));
  }
  
  const counts = new Array(11).fill(0)
  rawRolls.forEach(k => counts[k] += 1)
  expertRolls.forEach(k => counts[k] += 1)
  
  const sets = {}
  const looseDice = []
  let masterDice = new Array(masterCount).fill(10)
  
  counts.forEach((count, num) => {
    if (count === 0) return
    if (num < difficulty) return
    if (count === 1) looseDice.push(num)
    if (count >= 2) sets[num] = count
  })

  // Calculate sequences
  const allDice = [...rawRolls, ...expertRolls, ...masterDice]
  const sequences = calculateSequences(allDice)
  
  // Auto-detect contexts
  const weaponContext = detectWeaponContext(flavorText)
  const targetContext = getTargetContext()
  
  // Create sets array
  const setsArray = Object.entries(sets)
    .map(s => [parseInt(s[0], 10), s[1]])
    .sort((s1, s2) => s2[1] - s1[1] || s2[0] - s1[0])
    .map((s, index) => ({
      width: s[1],
      height: s[0],
      rollsInSet: new Array(s[1]).fill(s[0]),
      index: index
    }))
  
  // Calculate results
  const hitlocResults = calculateHitLocations(setsArray, targetContext)
  
  if (weaponContext) {
    weaponContext.calculatedDamages = calculateWeaponDamages(setsArray, weaponContext)
  }
  
  return {
    rawRolls,
    expertRolls,
    flavorText,
    sets: setsArray,
    looseDice,
    masterDice,
    sequences,
    weaponContext,
    targetContext,
    hitlocResults
  }
}

const getContentFromRollResult = async (rollResult) => {
  return await renderTemplate(`systems/oresystem/templates/ore-roll.html`, rollResult)
}

export const ORE = {
  createRawRoll,
  parseRawRoll,
  getContentFromRollResult,
  rollFromChatMessageOreCommand,
  calculateSequences,
  detectWeaponContext,
  getTargetContext,
  calculateHitLocations,
  calculateWeaponDamages,
  hooks: {
    HOOK_CLICK_SET,
    HOOK_CLICK_LOOSE_DIE,
  },
}

Hooks.on('init', () => {
  game.oneRollEngine = ORE
  console.log(`ORE | Initialized with smart auto-detection.`)
})
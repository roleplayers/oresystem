// ========================================================================
// ENHANCED ORE SYSTEM - Context Menu & Set Modifiers
// ========================================================================

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
 * Enhanced chat interactions with context menus
 */
Hooks.on('renderChatLog', () => {
  const chatLog = $('#chat-log')
  
  // Context menu for sets
  chatLog.on('contextmenu', '.ore-set-roll', (event) => {
    event.preventDefault()
    const setElement = event.currentTarget
    showSetContextMenu(event, setElement)
  })
  
  // Original set and dice clicking (left click)
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

  // Results panel toggle
  chatLog.on('click', '.results-header', (event) => {
    event.preventDefault()
    event.stopPropagation()
    const panel = event.currentTarget.closest('.ore-results-panel')
    if (panel) {
      panel.classList.toggle('expanded')
    }
  })
  
  // Close context menu when clicking elsewhere
  chatLog.on('click', (event) => {
    if (!$(event.target).closest('.ore-context-menu').length) {
      $('.ore-context-menu').remove()
    }
  })
})

// ========================================================================
// SET MODIFIER SYSTEM
// ========================================================================

class SetModifier {
  constructor(setElement) {
    this.element = setElement
    this.setIndex = parseInt(setElement.dataset.setIndex) || 0
    this.originalWidth = parseInt(setElement.dataset.originalWidth) || parseInt(setElement.dataset.width)
    this.originalHeight = parseInt(setElement.dataset.height)
    this.currentWidth = parseInt(setElement.dataset.width)
    this.appliedMaster = parseInt(setElement.dataset.appliedMaster) || 0
    this.appliedGobble = parseInt(setElement.dataset.appliedGobble) || 0
    
    // Store original values if not set
    if (!setElement.dataset.originalWidth) {
      setElement.dataset.originalWidth = this.originalWidth
      setElement.dataset.appliedMaster = this.appliedMaster
      setElement.dataset.appliedGobble = this.appliedGobble
    }
  }
  
  applyMasterDice(count = 1) {
    const availableMaster = this.getAvailableMasterDice()
    if (availableMaster < count) {
      ui.notifications.warn(`Only ${availableMaster} master dice available`)
      return false
    }
    
    this.currentWidth += count
    this.appliedMaster += count
    this.updateElementData()
    this.updateVisual()
    this.consumeMasterDice(count)
    
    ui.notifications.info(`Applied ${count} master dice. New width: ${this.currentWidth}`)
    return true
  }
  
  applyGobbleDice(count = 1) {
    // TODO: Implement gobble dice system
    const newWidth = Math.max(0, this.currentWidth - count)
    if (newWidth === this.currentWidth) {
      ui.notifications.warn("Cannot reduce width below 0")
      return false
    }
    
    this.currentWidth = newWidth
    this.appliedGobble += count
    this.updateElementData()
    this.updateVisual()
    
    ui.notifications.info(`Applied ${count} gobble dice. New width: ${this.currentWidth}`)
    return true
  }
  
  resetModifiers() {
    const originalMaster = this.appliedMaster
    this.currentWidth = this.originalWidth
    this.appliedMaster = 0
    this.appliedGobble = 0
    this.updateElementData()
    this.updateVisual()
    
    // Return master dice to pool
    if (originalMaster > 0) {
      this.returnMasterDice(originalMaster)
    }
    
    ui.notifications.info("Set modifiers reset")
  }
  
  updateElementData() {
    this.element.dataset.width = this.currentWidth
    this.element.dataset.appliedMaster = this.appliedMaster
    this.element.dataset.appliedGobble = this.appliedGobble
  }
  
  updateVisual() {
    // Update width display
    const notationElement = this.element.querySelector('.set-notation')
    if (notationElement) {
      notationElement.textContent = `${this.currentWidth}×${this.originalHeight}`
    }
    
    // Update visual indicators
    this.updateIndicators()
    
    // Update damage calculation if weapon context exists
    this.updateDamageDisplay()
    
    // Add visual feedback
    this.element.classList.add('set-modified')
    setTimeout(() => this.element.classList.remove('set-modified'), 300)
  }
  
  updateIndicators() {
    // Remove existing indicators
    this.element.querySelectorAll('.set-modifier-indicator').forEach(el => el.remove())
    
    const indicatorsContainer = document.createElement('div')
    indicatorsContainer.className = 'set-modifiers'
    
    // Master dice indicator
    if (this.appliedMaster > 0) {
      const masterIndicator = document.createElement('span')
      masterIndicator.className = 'set-modifier-indicator master-indicator'
      masterIndicator.innerHTML = `<i class="fas fa-crown"></i>+${this.appliedMaster}`
      masterIndicator.title = `${this.appliedMaster} Master Dice Applied`
      indicatorsContainer.appendChild(masterIndicator)
    }
    
    // Gobble dice indicator
    if (this.appliedGobble > 0) {
      const gobbleIndicator = document.createElement('span')
      gobbleIndicator.className = 'set-modifier-indicator gobble-indicator'
      gobbleIndicator.innerHTML = `<i class="fas fa-shield-alt"></i>-${this.appliedGobble}`
      gobbleIndicator.title = `${this.appliedGobble} Gobble Dice Applied`
      indicatorsContainer.appendChild(gobbleIndicator)
    }
    
    if (indicatorsContainer.children.length > 0) {
      this.element.appendChild(indicatorsContainer)
    }
  }
  
  updateDamageDisplay() {
    const rollContainer = this.element.closest('.one-roll-engine-dice-roll')
    if (!rollContainer) return
    
    const resultsPanel = rollContainer.querySelector('.ore-results-panel')
    if (!resultsPanel) return
    
    // Find corresponding result display
    const setResults = resultsPanel.querySelectorAll('.set-result')
    if (setResults[this.setIndex]) {
      const setResult = setResults[this.setIndex]
      const damageElement = setResult.querySelector('.damage-result')
      
      if (damageElement) {
        // Recalculate damage with current width
        const weaponContext = this.getWeaponContext()
        if (weaponContext) {
          const rollResult = {
            sets: [{
              width: this.currentWidth,
              height: this.originalHeight,
              rollsInSet: new Array(this.currentWidth).fill(this.originalHeight)
            }],
            looseDice: [],
            masterDice: []
          }
          
          const newDamage = weaponContext.weapon.getDamageString(rollResult)
          damageElement.textContent = newDamage
          damageElement.classList.add('damage-modified')
          setTimeout(() => damageElement.classList.remove('damage-modified'), 300)
        }
      }
    }
  }
  
  getAvailableMasterDice() {
    const rollContainer = this.element.closest('.one-roll-engine-dice-roll')
    if (!rollContainer) return 0
    
    const masterSection = rollContainer.querySelector('.ore-master-section')
    if (!masterSection) return 0
    
    const masterDiceElements = masterSection.querySelectorAll('.ore-single-roll:not(.consumed)')
    return masterDiceElements.length
  }
  
  consumeMasterDice(count) {
    const rollContainer = this.element.closest('.one-roll-engine-dice-roll')
    if (!rollContainer) return
    
    const masterSection = rollContainer.querySelector('.ore-master-section')
    if (!masterSection) return
    
    const availableDice = masterSection.querySelectorAll('.ore-single-roll:not(.consumed)')
    for (let i = 0; i < Math.min(count, availableDice.length); i++) {
      availableDice[i].classList.add('consumed')
      availableDice[i].style.opacity = '0.3'
      availableDice[i].title = 'Consumed'
    }
  }
  
  returnMasterDice(count) {
    const rollContainer = this.element.closest('.one-roll-engine-dice-roll')
    if (!rollContainer) return
    
    const masterSection = rollContainer.querySelector('.ore-master-section')
    if (!masterSection) return
    
    const consumedDice = masterSection.querySelectorAll('.ore-single-roll.consumed')
    for (let i = 0; i < Math.min(count, consumedDice.length); i++) {
      consumedDice[i].classList.remove('consumed')
      consumedDice[i].style.opacity = '1'
      consumedDice[i].title = ''
    }
  }
  
  getWeaponContext() {
    const rollContainer = this.element.closest('.one-roll-engine-dice-roll')
    if (!rollContainer) return null
    
    // Try to get weapon context from the roll data
    // This would need to be stored when the roll is made
    return rollContainer._weaponContext || null
  }
  
  calculateFinalDamage() {
    const weaponContext = this.getWeaponContext()
    if (!weaponContext) return null
    
    const rollResult = {
      sets: [{
        width: this.currentWidth,
        height: this.originalHeight,
        rollsInSet: new Array(this.currentWidth).fill(this.originalHeight)
      }],
      looseDice: [],
      masterDice: []
    }
    
    return weaponContext.weapon.calculateDamage(rollResult, 'main')
  }
}

// ========================================================================
// CONTEXT MENU SYSTEM
// ========================================================================

function showSetContextMenu(event, setElement) {
  // Remove existing menus
  $('.ore-context-menu').remove()
  
  const modifier = new SetModifier(setElement)
  const menuItems = buildContextMenuItems(modifier)
  
  if (menuItems.length === 0) {
    return // No available actions
  }
  
  const menu = createContextMenu(menuItems, modifier)
  positionContextMenu(menu, event.pageX, event.pageY)
  
  // Auto-hide after 10 seconds
  setTimeout(() => {
    if (menu && menu.parentNode) {
      menu.remove()
    }
  }, 10000)
}

function buildContextMenuItems(modifier) {
  const items = []
  const availableMaster = modifier.getAvailableMasterDice()
  const hasTargets = Array.from(game.user.targets).length > 0
  const weaponContext = modifier.getWeaponContext()
  
  // Master Dice options
  if (availableMaster > 0) {
    items.push({
      label: `Apply Master Dice (+${availableMaster} available)`,
      icon: 'fas fa-crown',
      action: () => modifier.applyMasterDice(1),
      submenu: availableMaster > 1 ? [
        { label: 'Apply 1', action: () => modifier.applyMasterDice(1) },
        { label: 'Apply 2', action: () => modifier.applyMasterDice(2), enabled: availableMaster >= 2 },
        { label: 'Apply 3', action: () => modifier.applyMasterDice(3), enabled: availableMaster >= 3 },
        { label: `Apply All (${availableMaster})`, action: () => modifier.applyMasterDice(availableMaster) }
      ] : null
    })
  }
  
  // Gobble Dice options (placeholder for future implementation)
  if (modifier.currentWidth > 0) {
    items.push({
      label: 'Apply Gobble Dice (Test)',
      icon: 'fas fa-shield-alt',
      action: () => modifier.applyGobbleDice(1),
      submenu: modifier.currentWidth > 1 ? [
        { label: 'Apply 1', action: () => modifier.applyGobbleDice(1) },
        { label: 'Apply 2', action: () => modifier.applyGobbleDice(2), enabled: modifier.currentWidth >= 2 }
      ] : null
    })
  }
  
  // Reset modifiers
  if (modifier.appliedMaster > 0 || modifier.appliedGobble > 0) {
    items.push({
      label: 'Reset Modifiers',
      icon: 'fas fa-undo',
      action: () => modifier.resetModifiers()
    })
  }
  
  // Separator
  if (items.length > 0 && (weaponContext || hasTargets)) {
    items.push({ separator: true })
  }
  
  // Damage calculation
  if (weaponContext) {
    items.push({
      label: 'Recalculate Damage',
      icon: 'fas fa-calculator',
      action: () => modifier.updateDamageDisplay()
    })
  }
  
  // Apply to targets (GM only)
  if (game.user.isGM && hasTargets) {
    const targets = Array.from(game.user.targets)
    items.push({
      label: `Apply to Targets (${targets.length})`,
      icon: 'fas fa-crosshairs',
      action: () => applyDamageToTargets(modifier),
      submenu: targets.length > 1 ? [
        { label: 'Apply to All', action: () => applyDamageToTargets(modifier, targets) },
        { separator: true },
        ...targets.map(target => ({
          label: target.name,
          action: () => applyDamageToTargets(modifier, [target])
        }))
      ] : null
    })
  }
  
  return items
}

function createContextMenu(items, modifier) {
  const menu = document.createElement('div')
  menu.className = 'ore-context-menu'
  
  items.forEach(item => {
    if (item.separator) {
      const separator = document.createElement('div')
      separator.className = 'menu-separator'
      menu.appendChild(separator)
      return
    }
    
    const menuItem = document.createElement('div')
    menuItem.className = 'menu-item'
    if (item.enabled === false) {
      menuItem.classList.add('disabled')
    }
    
    menuItem.innerHTML = `
      <i class="${item.icon}"></i>
      <span>${item.label}</span>
      ${item.submenu ? '<i class="fas fa-chevron-right submenu-arrow"></i>' : ''}
    `
    
    if (!item.submenu && item.action && item.enabled !== false) {
      menuItem.addEventListener('click', (e) => {
        e.stopPropagation()
        item.action()
        menu.remove()
      })
    }
    
    // Handle submenu
    if (item.submenu) {
      menuItem.addEventListener('mouseenter', () => {
        // Remove existing submenus
        menu.querySelectorAll('.submenu').forEach(sub => sub.remove())
        
        const submenu = createSubmenu(item.submenu, modifier)
        submenu.style.left = '100%'
        submenu.style.top = '0'
        menuItem.style.position = 'relative'
        menuItem.appendChild(submenu)
      })
    }
    
    menu.appendChild(menuItem)
  })
  
  document.body.appendChild(menu)
  return menu
}

function createSubmenu(items, modifier) {
  const submenu = document.createElement('div')
  submenu.className = 'ore-context-menu submenu'
  
  items.forEach(item => {
    if (item.separator) {
      const separator = document.createElement('div')
      separator.className = 'menu-separator'
      submenu.appendChild(separator)
      return
    }
    
    const menuItem = document.createElement('div')
    menuItem.className = 'menu-item'
    if (item.enabled === false) {
      menuItem.classList.add('disabled')
    }
    
    menuItem.innerHTML = `<span>${item.label}</span>`
    
    if (item.action && item.enabled !== false) {
      menuItem.addEventListener('click', (e) => {
        e.stopPropagation()
        item.action()
        document.querySelector('.ore-context-menu:not(.submenu)').remove()
      })
    }
    
    submenu.appendChild(menuItem)
  })
  
  return submenu
}

function positionContextMenu(menu, x, y) {
  menu.style.position = 'fixed'
  menu.style.left = x + 'px'
  menu.style.top = y + 'px'
  menu.style.zIndex = '10000'
  
  // Adjust position if menu goes off-screen
  const rect = menu.getBoundingClientRect()
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  
  if (rect.right > viewportWidth) {
    menu.style.left = (x - rect.width) + 'px'
  }
  
  if (rect.bottom > viewportHeight) {
    menu.style.top = (y - rect.height) + 'px'
  }
}

// ========================================================================
// DAMAGE APPLICATION SYSTEM
// ========================================================================

async function applyDamageToTargets(modifier, specificTargets = null) {
  const targets = specificTargets || Array.from(game.user.targets)
  if (targets.length === 0) {
    ui.notifications.warn("No targets selected")
    return
  }
  
  const finalDamage = modifier.calculateFinalDamage()
  if (!finalDamage) {
    ui.notifications.warn("Cannot calculate damage - no weapon context")
    return
  }
  
  for (const target of targets) {
    await applyDamageToSingleTarget(finalDamage, target, modifier.originalHeight)
  }
  
  ui.notifications.info(`Applied ${finalDamage.amount} ${finalDamage.type} damage to ${targets.length} target(s)`)
}

async function applyDamageToSingleTarget(damage, target, hitHeight) {
  if (!target.actor) {
    ui.notifications.warn(`Target ${target.name} has no actor`)
    return
  }
  
  // Find the hit location
  const hitLocs = target.actor.items.filter(i => i.type === 'hitloc')
  const hitLoc = hitLocs.find(loc => 
    hitHeight >= (loc.system.noStart || 0) && 
    hitHeight <= (loc.system.noEnd || 0)
  )
  
  if (!hitLoc) {
    ui.notifications.warn(`No hit location found for ${target.name} at height ${hitHeight}`)
    return
  }
  
  // Calculate final damage after armor
  const armor = hitLoc.system.armor || 0
  const finalDamage = Math.max(0, damage.amount - armor)
  
  if (finalDamage === 0) {
    ui.notifications.info(`Damage absorbed by armor on ${target.name}'s ${hitLoc.name}`)
    return
  }
  
  // Apply damage based on type
  let newShock = hitLoc.system.shock || 0
  let newKilling = hitLoc.system.killing || 0
  
  if (damage.type === 'killing') {
    newKilling += finalDamage
  } else {
    newShock += finalDamage
  }
  
  // Ensure we don't exceed maximum boxes
  const maxBoxes = hitLoc.system.max || 1
  const totalDamage = newShock + newKilling
  
  if (totalDamage > maxBoxes) {
    // Overflow handling - convert excess shock to killing
    if (damage.type === 'shock') {
      const excess = totalDamage - maxBoxes
      newShock = Math.max(0, newShock - excess)
      newKilling = Math.min(maxBoxes, newKilling + excess)
    } else {
      newKilling = Math.min(maxBoxes, newKilling)
    }
  }
  
  // Update the hit location
  await hitLoc.update({
    'system.shock': Math.min(newShock, maxBoxes),
    'system.killing': Math.min(newKilling, maxBoxes)
  })
  
  // Create damage message
  const damageMessage = `
    <div class="damage-application">
      <strong>${target.name}</strong> takes ${finalDamage} ${damage.type} damage
      ${armor > 0 ? `(${damage.amount} - ${armor} armor)` : ''}
      to <strong>${hitLoc.name}</strong>
    </div>
  `
  
  ChatMessage.create({
    content: damageMessage,
    speaker: ChatMessage.getSpeaker()
  })
}

// ========================================================================
// EXISTING FUNCTIONS (keeping for compatibility)
// ========================================================================

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
 * Main roll command handler
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
  
  const message = await ChatMessage.create(data, {})
  
  // Store weapon context in the message element for later use
  if (rollResult.weaponContext) {
    setTimeout(() => {
      const messageElement = document.querySelector(`[data-message-id="${message.id}"] .one-roll-engine-dice-roll`)
      if (messageElement) {
        messageElement._weaponContext = rollResult.weaponContext
      }
    }, 100)
  }
  
  return message
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
  
  // Create sets array with enhanced data
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
  SetModifier,
  hooks: {
    HOOK_CLICK_SET,
    HOOK_CLICK_LOOSE_DIE,
  },
}

Hooks.on('init', () => {
  game.oneRollEngine = ORE
  console.log(`ORE | Enhanced system initialized with context menus and set modifiers.`)
})
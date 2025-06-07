/**
 * Extend the basic Item with some very simple modifications.
 * @extends {Item}
 */

export class ReignItem extends Item {
  /**
   * Augment the basic Item data model with additional dynamic data.
   */
  prepareData() {
    // As with the actor class, items are documents that can have their data
    // preparation methods overridden (such as prepareBaseData()).
    super.prepareData();
  }

  async _preCreate(data, options, userId) {
    await super._preCreate(data, options, userId);

    // assign a default image
    if (!data.img && data.type === 'skill') {
      const img = "systems/oresystem/images/items/skills.svg";
      if (img) await this.updateSource({ img });
    }
    if (!data.img && data.type === 'weapon') {
      // Use Foundry's default weapon icon instead of a custom one
      const img = "icons/weapons/swords/sword-broad-steel.webp";
      await this.updateSource({ img });
    }
  }

  /**
   * Prepare a data object which is passed to any Roll formulas which are created related to this Item
   * @private
   */
  getRollData() {
    // If present, return the actor's roll data.
    if (!this.actor) return null;
    const rollData = this.actor.getRollData();
    rollData.item = foundry.utils.deepClone(this.system);

    return rollData;
  }

  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @param {Object} options   Optional parameters for advanced rolls
   * @private
   */
  async roll(options = {}) {
    const ORE = game.oneRollEngine;

    const item = this;

    // Initialize chat data.
    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const label = `[${item.type}] ${item.name}`;

    let fakeData = {
      content: '',
      type: CONST.CHAT_MESSAGE_TYPES.OTHER,
      rolls: [],
      flags: { core: { canPopout: true } }
    }

    // Construct the roll
    let str;
    let difficulty = options.difficulty !== undefined ? options.difficulty : (this.actor.system.difficulty || 0);
    let penalty = options.penalty !== undefined ? options.penalty : 0; // Use only passed penalty
    
    if (this.type == "skill") {
      // Use custom linked stat if provided, otherwise use default
      const linkedStatName = options.linkedStat || this.system.stat;
      let linkedStat = null;
      if (linkedStatName) {
        linkedStat = this.actor.items.getName(linkedStatName);
      }
      
      if (linkedStat) {
        const totalD = (item.system.d || 0) + (linkedStat.system.d || 0) + (options.diceModifier || 0);
        const totalED = (item.system.ed || 0) + (linkedStat.system.ed || 0) + (options.edModifier || 0);
        const totalMD = (item.system.md || 0) + (linkedStat.system.md || 0) + (options.mdModifier || 0);
        const edSet = options.edSet !== undefined ? options.edSet : (item.system.ed_set || 10);
        
        // Build flavor text
        let flavorParts = [item.name];
        if (options.linkedStat && options.linkedStat !== this.system.stat) {
          flavorParts.push(`(using ${options.linkedStat})`);
        }
        if (options.customFlavor) {
          flavorParts.push(`- ${options.customFlavor}`);
        }
        
        // Add target information if available
        const targets = Array.from(game.user.targets);
        if (targets.length > 0) {
          const targetNames = targets.map(t => t.name).join(', ');
          flavorParts.push(`→ ${targetNames}`);
        }
        
        const flavorText = flavorParts.join(' ');
        
        str = `/ore ${Math.max(1, totalD)}d ${Math.max(0, totalED)}e${edSet} dif ${difficulty} pen ${penalty} md ${Math.max(0, totalMD)} # ${flavorText}`;
      } else {
        const totalD = (item.system.d || 0) + (options.diceModifier || 0);
        const totalED = (item.system.ed || 0) + (options.edModifier || 0);
        const totalMD = (item.system.md || 0) + (options.mdModifier || 0);
        const edSet = options.edSet !== undefined ? options.edSet : (item.system.ed_set || 10);
        
        let flavorText = item.name;
        if (options.customFlavor) {
          flavorText += ` - ${options.customFlavor}`;
        }
        
        str = `/ore ${Math.max(1, totalD)}d ${Math.max(0, totalED)}e${edSet} dif ${difficulty} pen ${penalty} md ${Math.max(0, totalMD)} # ${flavorText}`;
      }
    } else {
      // For non-skill items (stats, powers, etc.)
      const totalD = (item.system.d || 0) + (options.diceModifier || 0);
      const totalED = (item.system.ed || 0) + (options.edModifier || 0);
      const totalMD = (item.system.md || 0) + (options.mdModifier || 0);
      const edSet = options.edSet !== undefined ? options.edSet : (item.system.ed_set || 10);
      
      let flavorText = item.name;
      if (options.customFlavor) {
        flavorText += ` - ${options.customFlavor}`;
      }
      
      // Add target information if available
      const targets = Array.from(game.user.targets);
      if (targets.length > 0) {
        const targetNames = targets.map(t => t.name).join(', ');
        flavorText += ` → ${targetNames}`;
      }
      
      str = `/ore ${Math.max(1, totalD)}d ${Math.max(0, totalED)}e${edSet} dif ${difficulty} pen ${penalty} md ${Math.max(0, totalMD)} # ${flavorText}`;
    }

    await ORE.rollFromChatMessageOreCommand(str, fakeData);
  }

  /**
   * Roll a specific weapon action (attack, parry, dodge)
   * @param {string} action - The action to roll (attack, parry, dodge)
   * @param {Object} options - Optional parameters for advanced rolls
   */
  async rollWeaponAction(action, options = {}) {
    if (this.type !== 'weapon') {
      ui.notifications.error("This item is not a weapon.");
      return;
    }

    if (!['attack', 'parry', 'dodge'].includes(action)) {
      ui.notifications.error("Invalid weapon action.");
      return;
    }

    const ORE = game.oneRollEngine;
    const actionData = this.system[action];

    if (!actionData) {
      ui.notifications.error(`No ${action} configuration found for this weapon.`);
      return;
    }

    // Get skill and stat
    const skillName = options.linkedStat || actionData.skill;
    const statName = options.linkedStat || actionData.stat;
    
    let skill = null;
    let stat = null;
    
    if (skillName) {
      skill = this.actor.items.getName(skillName);
    }
    if (statName) {
      stat = this.actor.items.getName(statName);
    }

    // Calculate dice pools
    let totalD = 0;
    let totalED = 0;
    let totalMD = 0;

    // Add skill dice
    if (skill) {
      totalD += skill.system.d || 0;
      totalED += skill.system.ed || 0;
      totalMD += skill.system.md || 0;
    }

    // Add stat dice
    if (stat) {
      totalD += stat.system.d || 0;
      totalED += stat.system.ed || 0;
      totalMD += stat.system.md || 0;
    }

    // Add weapon bonuses
    totalD += actionData.dicebonus || 0;
    totalED += actionData.edbonus || 0;
    totalMD += actionData.mdbonus || 0;

    // Add option modifiers
    totalD += options.diceModifier || 0;
    totalED += options.edModifier || 0;
    totalMD += options.mdModifier || 0;

    // Ensure minimums
    totalD = Math.max(1, totalD);
    totalED = Math.max(0, totalED);
    totalMD = Math.max(0, totalMD);

    const edSet = options.edSet !== undefined ? options.edSet : 10;
    const difficulty = options.difficulty !== undefined ? options.difficulty : (this.actor.system.difficulty || 0);
    const penalty = options.penalty !== undefined ? options.penalty : 0;

    // Build flavor text
    let flavorParts = [this.name, `(${action.charAt(0).toUpperCase() + action.slice(1)})`];
    
    if (skill && stat) {
      flavorParts.push(`${skill.name} + ${stat.name}`);
    } else if (skill) {
      flavorParts.push(`${skill.name}`);
    } else if (stat) {
      flavorParts.push(`${stat.name}`);
    }

    if (actionData.dicebonus || actionData.edbonus || actionData.mdbonus) {
      const bonuses = [];
      if (actionData.dicebonus) bonuses.push(`+${actionData.dicebonus}d`);
      if (actionData.edbonus) bonuses.push(`+${actionData.edbonus}e`);
      if (actionData.mdbonus) bonuses.push(`+${actionData.mdbonus}m`);
      if (bonuses.length > 0) {
        flavorParts.push(`[${bonuses.join(' ')}]`);
      }
    }

    if (options.customFlavor) {
      flavorParts.push(`- ${options.customFlavor}`);
    }

    // Add target information if available
    const targets = Array.from(game.user.targets);
    if (targets.length > 0) {
      const targetNames = targets.map(t => t.name).join(', ');
      flavorParts.push(`→ ${targetNames}`);
    }

    const flavorText = flavorParts.join(' ');

    // Create ORE command string
    const str = `/ore ${totalD}d ${totalED}e${edSet} dif ${difficulty} pen ${penalty} md ${totalMD} # ${flavorText}`;

    // Execute the roll
    let fakeData = {
      content: '',
      type: CONST.CHAT_MESSAGE_TYPES.OTHER,
      rolls: [],
      flags: { core: { canPopout: true } }
    };

    await ORE.rollFromChatMessageOreCommand(str, fakeData);
  }

  /**
   * Show advanced roll dialog for this item
   * @param {Actor} actor The actor rolling this item
   */
  async showAdvancedRollDialog(actor = null) {
    if (!actor) actor = this.actor;
    if (!actor) {
      ui.notifications.error("Este item não está associado a um ator.");
      return;
    }

    const stats = actor.items.filter(i => i.type === 'stat');
    const targets = Array.from(game.user.targets);
    
    // Get current linked stat
    let linkedStat = null;
    if (this.type === 'skill' && this.system.stat) {
      linkedStat = actor.items.getName(this.system.stat);
    }

    // Calculate base dice pools
    let baseDice = this.system.d || 0;
    let baseED = this.system.ed || 0;
    let baseMD = this.system.md || 0;
    let baseEDSet = this.system.ed_set || 10;

    if (linkedStat && this.type === 'skill') {
      baseDice += linkedStat.system.d || 0;
      baseED += linkedStat.system.ed || 0;
      baseMD += linkedStat.system.md || 0;
    }

    const dialogContent = await renderTemplate("systems/oresystem/templates/dialogs/advanced-roll-dialog.html", {
      item: this,
      stats: stats,
      targets: targets,
      linkedStat: linkedStat,
      baseDice: baseDice,
      baseED: baseED,
      baseMD: baseMD,
      baseEDSet: baseEDSet,
      difficulty: actor.system.difficulty || 0,
      penalty: 0 // Always start with 0 penalty in dialog
    });

    return new Promise((resolve) => {
      new Dialog({
        title: `Advanced Roll: ${this.name}`,
        content: dialogContent,
        buttons: {
          roll: {
            icon: '<i class="fas fa-dice-d20"></i>',
            label: "Roll",
            callback: (html) => {
              const formData = new FormData(html[0].querySelector("form"));
              const data = {};
              for (let [key, value] of formData.entries()) {
                if (value !== '') {
                  data[key] = isNaN(value) ? value : Number(value);
                }
              }
              this.roll(data);
              resolve(true);
            }
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: "Cancel",
            callback: () => resolve(false)
          }
        },
        default: "roll",
        render: (html) => {
          // Auto-update total dice when modifiers change
          html.find('input[name="diceModifier"], input[name="edModifier"], input[name="mdModifier"], input[name="penalty"], select[name="linkedStat"]').change(() => {
            this._updateDialogTotalDice(html, stats);
          });
        },
        close: () => resolve(false)
      }, {
        width: 500,
        height: 600
      }).render(true);
    });
  }

  /**
   * Update total dice display in the dialog
   */
  _updateDialogTotalDice(html, stats) {
    const formData = new FormData(html[0].querySelector("form"));
    const data = {};
    for (let [key, value] of formData.entries()) {
      data[key] = value;
    }

    let totalDice = parseInt(this.system.d) || 0;
    let totalED = parseInt(this.system.ed) || 0;
    let totalMD = parseInt(this.system.md) || 0;

    // Add linked stat if different from original
    const newLinkedStatName = data.linkedStat || this.system.stat;
    if (newLinkedStatName && this.type === 'skill') {
      const newLinkedStat = stats.find(s => s.name === newLinkedStatName);
      if (newLinkedStat) {
        totalDice += parseInt(newLinkedStat.system.d) || 0;
        totalED += parseInt(newLinkedStat.system.ed) || 0;
        totalMD += parseInt(newLinkedStat.system.md) || 0;
      }
    }

    // Add modifiers
    totalDice += parseInt(data.diceModifier) || 0;
    totalED += parseInt(data.edModifier) || 0;
    totalMD += parseInt(data.mdModifier) || 0;

    // Apply penalty logic (same as in one_roll_engine.js)
    let penalty = parseInt(data.penalty) || 0;
    let finalMD = totalMD;
    let finalED = totalED;
    let finalDice = totalDice;
    
    // Apply penalty to master dice first
    if (finalMD > 0 && penalty > 0) {
      const penaltyToMD = Math.min(penalty, finalMD);
      finalMD -= penaltyToMD;
      penalty -= penaltyToMD;
    }
    
    // Apply remaining penalty to expert dice
    if (finalED > 0 && penalty > 0) {
      const penaltyToED = Math.min(penalty, finalED);
      finalED -= penaltyToED;
      penalty -= penaltyToED;
    }
    
    // Apply remaining penalty to normal dice
    if (penalty > 0) {
      finalDice = Math.max(0, finalDice - penalty);
    }

    // Ensure minimums
    finalDice = Math.max(0, finalDice);
    finalED = Math.max(0, finalED);
    finalMD = Math.max(0, finalMD);

    const edSet = data.edSet || this.system.ed_set || 10;

    html.find('#totalDiceDisplay').text(`Total: ${finalDice}d ${finalED}e${edSet} ${finalMD}m`);
  }
}
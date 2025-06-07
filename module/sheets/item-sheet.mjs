/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 */
export class ReignItemSheet extends ItemSheet {

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["oresystem", "sheet", "item"],
      width: 520,
      height: 480,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }]
    });
  }

  /** @override */
  get template() {
    const path = "systems/oresystem/templates/item";
    // Return a single sheet for all item types.
    //return `${path}/item-sheet.html`;

    // Alternatively, you could use the following return statement to do a
    // unique item sheet by type, like `weapon-sheet.html`.
    return `${path}/item-${this.item.type}-sheet.html`;
  }

  /* -------------------------------------------- */

  /** @override */
  getData() {
    // Retrieve base data structure.
    const context = super.getData();

    // Use a safe clone of the item data for further operations.
    const itemData = context.item;

    // Retrieve the roll data for TinyMCE editors.
    context.rollData = {};
    let actor = this.object?.parent ?? null;
    if (actor) {
      context.rollData = actor.getRollData();

      // We need to be able to choose from the other stats.
      // Initialize containers.
      const stats = [];
      const skills = [];
      const powers = [];
      const hitlocs = [];
      const weapons = [];

      // Iterate through items, allocating to containers
      for (let i of actor.items) {
        // Append to appropriate arrays.
        if (i.type === 'stat') {
          stats.push(i);
        } else if (i.type === 'skill') {
          skills.push(i);
        } else if (i.type === 'power') {
          powers.push(i);
        } else if (i.type === 'hitloc') {
          hitlocs.push(i);
        } else if (i.type === 'weapon') {
          weapons.push(i);
        }
      }

      // Assign and return
      context.stats = stats;
      context.skills = skills;
      context.powers = powers;
      context.hitlocs = hitlocs;
      context.weapons = weapons;
    }

    // Add the item's data to context.system for easier access, as well as flags.
    context.system = itemData.system;
    context.flags = itemData.flags;

    return context;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Weapon roll buttons
    html.find('.weapon-roll-btn').click(this._onWeaponRoll.bind(this));

    // Roll handlers, click handlers, etc. would go here.
  }

  /**
   * Handle weapon action rolls
   * @param {Event} event The originating click event
   * @private
   */
  async _onWeaponRoll(event) {
    event.preventDefault();
    
    if (this.item.type !== 'weapon') {
      ui.notifications.error("This item is not a weapon.");
      return;
    }

    const action = event.currentTarget.dataset.action;
    
    if (!['attack', 'parry', 'dodge'].includes(action)) {
      ui.notifications.error("Invalid weapon action.");
      return;
    }

    // Check if Ctrl+click for advanced dialog
    if (event.ctrlKey) {
      return this._showWeaponAdvancedRollDialog(action);
    } else {
      return this.item.rollWeaponAction(action);
    }
  }

  /**
   * Show advanced roll dialog for weapon actions
   * @param {string} action The weapon action (attack, parry, dodge)
   */
  async _showWeaponAdvancedRollDialog(action) {
    const actor = this.item.actor;
    if (!actor) {
      ui.notifications.error("This weapon is not associated with an actor.");
      return;
    }

    const stats = actor.items.filter(i => i.type === 'stat');
    const skills = actor.items.filter(i => i.type === 'skill');
    const targets = Array.from(game.user.targets);
    const actionData = this.item.system[action];
    
    // Get current linked skill and stat
    let linkedSkill = null;
    let linkedStat = null;
    
    if (actionData.skill) {
      linkedSkill = actor.items.getName(actionData.skill);
    }
    if (actionData.stat) {
      linkedStat = actor.items.getName(actionData.stat);
    }

    // Calculate base dice pools
    let baseDice = 0;
    let baseED = 0;
    let baseMD = 0;

    if (linkedSkill) {
      baseDice += linkedSkill.system.d || 0;
      baseED += linkedSkill.system.ed || 0;
      baseMD += linkedSkill.system.md || 0;
    }

    if (linkedStat) {
      baseDice += linkedStat.system.d || 0;
      baseED += linkedStat.system.ed || 0;
      baseMD += linkedStat.system.md || 0;
    }

    // Add weapon bonuses
    baseDice += actionData.dicebonus || 0;
    baseED += actionData.edbonus || 0;
    baseMD += actionData.mdbonus || 0;

    const dialogContent = await renderTemplate("systems/oresystem/templates/dialogs/weapon-advanced-roll-dialog.html", {
      weapon: this.item,
      action: action,
      stats: stats,
      skills: skills,
      targets: targets,
      linkedSkill: linkedSkill,
      linkedStat: linkedStat,
      actionData: actionData,
      baseDice: baseDice,
      baseED: baseED,
      baseMD: baseMD,
      baseEDSet: 10,
      difficulty: actor.system.difficulty || 0,
      penalty: 0
    });

    return new Promise((resolve) => {
      new Dialog({
        title: `Advanced ${action.charAt(0).toUpperCase() + action.slice(1)}: ${this.item.name}`,
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
              this.item.rollWeaponAction(action, data);
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
          html.find('input, select').change(() => {
            this._updateWeaponDialogTotalDice(html, action, stats, skills);
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
   * Update total dice display in weapon dialog
   */
  _updateWeaponDialogTotalDice(html, action, stats, skills) {
    const formData = new FormData(html[0].querySelector("form"));
    const data = {};
    for (let [key, value] of formData.entries()) {
      data[key] = value;
    }

    const actionData = this.item.system[action];
    let totalDice = 0;
    let totalED = 0;
    let totalMD = 0;

    // Add skill dice
    const skillName = data.linkedSkill || actionData.skill;
    if (skillName) {
      const skill = skills.find(s => s.name === skillName);
      if (skill) {
        totalDice += parseInt(skill.system.d) || 0;
        totalED += parseInt(skill.system.ed) || 0;
        totalMD += parseInt(skill.system.md) || 0;
      }
    }

    // Add stat dice
    const statName = data.linkedStat || actionData.stat;
    if (statName) {
      const stat = stats.find(s => s.name === statName);
      if (stat) {
        totalDice += parseInt(stat.system.d) || 0;
        totalED += parseInt(stat.system.ed) || 0;
        totalMD += parseInt(stat.system.md) || 0;
      }
    }

    // Add weapon bonuses
    totalDice += parseInt(actionData.dicebonus) || 0;
    totalED += parseInt(actionData.edbonus) || 0;
    totalMD += parseInt(actionData.mdbonus) || 0;

    // Add modifiers
    totalDice += parseInt(data.diceModifier) || 0;
    totalED += parseInt(data.edModifier) || 0;
    totalMD += parseInt(data.mdModifier) || 0;

    // Apply penalty logic
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

    const edSet = data.edSet || 10;

    html.find('#totalDiceDisplay').text(`Total: ${finalDice}d ${finalED}e${edSet} ${finalMD}m`);
  }
}
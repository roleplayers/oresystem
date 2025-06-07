/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class ReignActorSheet extends ActorSheet {

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["oresystem", "sheet", "actor"],
      template: "systems/oresystem/templates/actor/actor-sheet.html",
      width: 1000,
      height: 768,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }]
    });
  }

  /** @override */
  get template() {
    return `systems/oresystem/templates/actor/actor-${this.actor.type}-sheet.html`;
  }

  /** @override */
  getData() {
    try {
      const context = super.getData();

      // Use a safe clone of the actor data for further operations.
      const actorData = this.actor.toObject(false);

      // Add the actor's data to context.system for easier access, as well as flags.
      context.system = actorData.system;
      context.flags = actorData.flags;

      // Prepare character data and items.
      if (actorData.type == 'character') {
        this._prepareItems(context);
        this._prepareCharacterData(context);
      }

      // Prepare NPC data and items.
      if (actorData.type == 'npc') {
        this._prepareItems(context);
      }

      // Add roll data for TinyMCE editors.
      context.rollData = context.actor.getRollData();

      return context;
    } catch (error) {
      console.error("Error in ReignActorSheet getData():", error);
      throw error;
    }
  }

  /**
   * Organize and classify Items for Character sheets.
   */
  _prepareCharacterData(context) {
    // Character-specific data preparation can be added here
  }

  /**
   * Organize and classify Items for Character sheets.
   */
  _prepareItems(context) {
    try {
      // Initialize containers.
      const stats = [];
      const skills = [];
      const powers = [];
      const hitlocs = [];
      const weapons = [];

      // Iterate through items, allocating to containers then adding the poolTotal flag
      for (let i of context.items) {
        i.img = i.img || DEFAULT_TOKEN;
        
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

        const itemSystem = i.system;
        if (!i.flags.oresystem) {
          i.flags.oresystem = {}
        }
        if (i.type == "skill") {
          let linkedStat = context.items.find(x => x.name == itemSystem.stat)
          if (linkedStat) {
            i.flags.oresystem["poolTotal"] = (itemSystem.d + linkedStat.system.d) + "d/" + (itemSystem.ed + linkedStat.system.ed) + "e (" + itemSystem.ed_set + ")/" + (itemSystem.md + linkedStat.system.md) + "m";
          }
        } else {
          i.flags.oresystem["poolTotal"] = (itemSystem.d + "d/" + itemSystem.ed + "e (" + itemSystem.ed_set + ")/" + itemSystem.md + "m");
        }
      }

      // Sort stats by sort field, then by name
      stats.sort((a, b) => {
        const sortA = a.system.sort || 0;
        const sortB = b.system.sort || 0;
        if (sortA !== sortB) {
          return sortA - sortB;
        }
        return a.name.localeCompare(b.name);
      });

      // split skills by base stat
      let sortedSkills = {};
      let myStatList = [];
      for (let i of stats) {
        myStatList.push(i.name)
      }
      myStatList.push("Any")
      for (let i of myStatList) {
        sortedSkills[i] = []
      }
      for (let i of skills) {
        if (!myStatList.includes(i.system.stat) && i.system.stat) {
          myStatList.push(i.system.stat)
          sortedSkills[i.system.stat] = [];
        }
        if (!i.system.stat) {
          sortedSkills["Any"].push(i);
        } else {
          sortedSkills[i.system.stat].push(i);
        }
      }

      // Dividir stats em duas colunas (apenas os stats reais, não "Any")
      const realStatNames = stats.map(s => s.name); // Só os stats ordenados
      const midPoint = Math.ceil(realStatNames.length / 2);
      const leftColumnStats = realStatNames.slice(0, midPoint);
      const rightColumnStats = realStatNames.slice(midPoint);
      
      // Se existem skills sem stat ("Any"), adiciona na segunda coluna
      if (sortedSkills["Any"] && sortedSkills["Any"].length > 0) {
        rightColumnStats.push("Any");
      }

      // sort hitlocs by location
      hitlocs.sort((a, b) => (a.system.noEnd < b.system.noEnd) ? 1 : -1)

      // sort weapons by name
      weapons.sort((a, b) => a.name.localeCompare(b.name));

      // Assign and return
      context.stats = stats;
      context.skills = skills;
      context.sortedSkills = sortedSkills;
      context.leftColumnStats = leftColumnStats;
      context.rightColumnStats = rightColumnStats;
      context.powers = powers;
      context.hitlocs = hitlocs;
      context.weapons = weapons;
      
    } catch (error) {
      console.error("Error in _prepareItems:", error);
    }
  }

/** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Setup initial counters
    this._setupSquareCounters(html)

    // Edit item handler - FIXED FOR SIDEBAR HIT LOCATIONS
    html.find('.item-edit').click(ev => {
      ev.preventDefault();
      
      const element = $(ev.currentTarget);
      let itemId = null;
      
      // First try: look for .item parent (main content area)
      const li = element.parents(".item");
      if (li.length && li.data("itemId")) {
        itemId = li.data("itemId");
      }
      
      // Second try: look for sidebar hit location
      if (!itemId) {
        const sidebarHitloc = element.closest('.sidebar-hitloc-item');
        if (sidebarHitloc.length) {
          itemId = sidebarHitloc.data('item-id') || sidebarHitloc.attr('data-item-id');
        }
      }
      
      // Third try: look for weapon item
      if (!itemId) {
        const weaponItem = element.closest('.weapon-item');
        if (weaponItem.length) {
          itemId = weaponItem.data('item-id') || weaponItem.attr('data-item-id');
        }
      }
      
      // Fourth try: look for data-name attribute
      if (!itemId) {
        const dataNameElement = element.closest('[data-name]');
        if (dataNameElement.length) {
          itemId = dataNameElement.attr('data-name') || dataNameElement.data('name');
        }
      }
      
      // Fifth try: look for resource counter
      if (!itemId) {
        const resourceCounter = element.siblings('.damage-boxes-line, .damage-boxes-compact').find('.resource-counter');
        if (resourceCounter.length) {
          itemId = resourceCounter.data('name');
        }
      }
      
      if (itemId) {
        const item = this.actor.items.get(itemId);
        if (item) {
          item.sheet.render(true);
        } else {
          ui.notifications.error(`Item com ID ${itemId} não encontrado.`);
        }
      } else {
        ui.notifications.error("Não foi possível identificar o item para edição.");
      }
    });

    if (!this.isEditable) return;

    // Weapon action buttons
    html.find('.weapon-action-btn').click(this._onWeaponAction.bind(this));

    // Stat reordering
    html.find('.stat-move-up').click(ev => {
      this._onStatMoveUp(ev);
    });
    
    html.find('.stat-move-down').click(ev => {
      this._onStatMoveDown(ev);
    });

    // Damage counter clicks
    html.find('.resource-counter > .resource-counter-step').click(this._onSquareCounterChange.bind(this))

    // Add item (general)
    html.find('.item-create').click(this._onItemCreate.bind(this));

    // Delete item with confirmation - FIXED FOR SIDEBAR HIT LOCATIONS AND WEAPONS
    html.find('.item-delete').click(ev => {
      const element = $(ev.currentTarget);
      let itemId = null;
      
      // First try: look for .item parent (main content area)
      const li = element.parents(".item");
      if (li.length && li.data("itemId")) {
        itemId = li.data("itemId");
      }
      
      // Second try: look for sidebar hit location
      if (!itemId) {
        const sidebarHitloc = element.closest('.sidebar-hitloc-item');
        if (sidebarHitloc.length) {
          itemId = sidebarHitloc.data('item-id') || sidebarHitloc.attr('data-item-id');
        }
      }
      
      // Third try: look for weapon item
      if (!itemId) {
        const weaponItem = element.closest('.weapon-item');
        if (weaponItem.length) {
          itemId = weaponItem.data('item-id') || weaponItem.attr('data-item-id');
        }
      }
      
      // Fourth try: look for data-name attribute
      if (!itemId) {
        const hitlocDiv = element.closest('[data-name]');
        if (hitlocDiv.length) {
          itemId = hitlocDiv.data("name");
        }
      }
      
      if (itemId) {
        const item = this.actor.items.get(itemId);
        if (item) {
          Dialog.confirm({
            title: "Remover Item",
            content: `<p>Tem certeza que deseja remover <strong>${item.name}</strong>?</p>`,
            yes: () => {
              item.delete();
              const parentElement = li.length ? li : element.closest('.hitloc-item, [data-name], .sidebar-hitloc-item, .weapon-item');
              parentElement.slideUp(200, () => this.render(false));
            },
            no: () => {},
            defaultYes: false
          });
        }
      }
    });

    // Rollable abilities
    html.find('.rollable').click(this._onRoll.bind(this));

    // Drag events
    if (this.actor.isOwner) {
      let handler = ev => this._onDragStart(ev);
      html.find('li.item').each((i, li) => {
        if (li.classList.contains("inventory-header")) return;
        li.setAttribute("draggable", true);
        li.addEventListener("dragstart", handler, false);
      });
      
      html.find('.hitloc-item, .sidebar-hitloc-item, .weapon-item').each((i, div) => {
        div.setAttribute("draggable", true);
        div.addEventListener("dragstart", handler, false);
      });
    }
  }

  /**
   * Handle weapon action buttons
   * @param {Event} event The originating click event
   * @private
   */
  async _onWeaponAction(event) {
    event.preventDefault();
    
    const weaponId = event.currentTarget.dataset.weaponId;
    const action = event.currentTarget.dataset.action;
    
    if (!weaponId || !action) {
      ui.notifications.error("Invalid weapon action data.");
      return;
    }

    const weapon = this.actor.items.get(weaponId);
    if (!weapon || weapon.type !== 'weapon') {
      ui.notifications.error("Weapon not found.");
      return;
    }

    // Check if Ctrl+click for advanced dialog
    if (event.ctrlKey) {
      return this._showWeaponAdvancedRollDialog(weapon, action);
    } else {
      return weapon.rollWeaponAction(action);
    }
  }

  /**
   * Show advanced roll dialog for weapon actions
   * @param {Item} weapon The weapon item
   * @param {string} action The weapon action (attack, parry, dodge)
   */
  async _showWeaponAdvancedRollDialog(weapon, action) {
    const stats = this.actor.items.filter(i => i.type === 'stat');
    const skills = this.actor.items.filter(i => i.type === 'skill');
    const targets = Array.from(game.user.targets);
    const actionData = weapon.system[action];
    
    // Get current linked skill and stat
    let linkedSkill = null;
    let linkedStat = null;
    
    if (actionData.skill) {
      linkedSkill = this.actor.items.getName(actionData.skill);
    }
    if (actionData.stat) {
      linkedStat = this.actor.items.getName(actionData.stat);
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
      weapon: weapon,
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
      difficulty: this.actor.system.difficulty || 0,
      penalty: 0
    });

    return new Promise((resolve) => {
      new Dialog({
        title: `Advanced ${action.charAt(0).toUpperCase() + action.slice(1)}: ${weapon.name}`,
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
              weapon.rollWeaponAction(action, data);
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
            this._updateWeaponDialogTotalDice(html, weapon, action, stats, skills);
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
  _updateWeaponDialogTotalDice(html, weapon, action, stats, skills) {
    const formData = new FormData(html[0].querySelector("form"));
    const data = {};
    for (let [key, value] of formData.entries()) {
      data[key] = value;
    }

    const actionData = weapon.system[action];
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

  /**
   * Handle moving stat up in order
   */
  async _onStatMoveUp(event) {
    event.preventDefault();
    
    const li = $(event.currentTarget).parents(".item");
    const itemId = li.data("itemId");
    
    const item = this.actor.items.get(itemId);
    
    if (!item || item.type !== 'stat') {
      return;
    }
    
    // Get all stats and ensure they have unique sort values
    const allStats = this.actor.items.filter(i => i.type === 'stat');
    await this._ensureUniqueSortValues(allStats);
    
    // Re-fetch stats after ensuring unique sort values
    const sortedStats = this.actor.items.filter(i => i.type === 'stat').sort((a, b) => {
      const sortA = a.system.sort || 0;
      const sortB = b.system.sort || 0;
      if (sortA !== sortB) return sortA - sortB;
      return a.name.localeCompare(b.name);
    });
    
    const currentIndex = sortedStats.findIndex(s => s.id === itemId);
    
    if (currentIndex <= 0) {
      return; // Already at top
    }
    
    const currentItem = sortedStats[currentIndex];
    const prevStat = sortedStats[currentIndex - 1];
    const currentSort = currentItem.system.sort || 0;
    const prevSort = prevStat.system.sort || 0;
    
    // Swap sort values
    await currentItem.update({"system.sort": prevSort});
    await prevStat.update({"system.sort": currentSort});
  }

  /**
   * Ensure all stats have unique sort values
   */
  async _ensureUniqueSortValues(stats) {
    const updates = [];
    let needsUpdate = false;
    
    // Check if any stats have duplicate or missing sort values
    const sortValues = stats.map(s => s.system.sort || 0);
    const hasDuplicates = sortValues.length !== new Set(sortValues).size;
    const hasUndefined = stats.some(s => s.system.sort === undefined || s.system.sort === null);
    
    if (hasDuplicates || hasUndefined) {
      console.log("ORE System | Fixing duplicate sort values for stats");
      
      // Sort stats by current sort value, then by name for consistent ordering
      const sortedStats = [...stats].sort((a, b) => {
        const sortA = a.system.sort || 0;
        const sortB = b.system.sort || 0;
        if (sortA !== sortB) return sortA - sortB;
        return a.name.localeCompare(b.name);
      });
      
      // Assign new unique sort values
      for (let i = 0; i < sortedStats.length; i++) {
        if (sortedStats[i].system.sort !== i) {
          updates.push({
            _id: sortedStats[i].id,
            'system.sort': i
          });
          needsUpdate = true;
        }
      }
      
      if (needsUpdate) {
        console.log(`ORE System | Updating ${updates.length} stat sort values`);
        await this.actor.updateEmbeddedDocuments('Item', updates);
      }
    }
  }

  /**
   * Handle moving stat down in order
   */
  async _onStatMoveDown(event) {
    event.preventDefault();
    
    const li = $(event.currentTarget).parents(".item");
    const itemId = li.data("itemId");
    
    const item = this.actor.items.get(itemId);
    
    if (!item || item.type !== 'stat') {
      return;
    }
    
    // Get all stats and ensure they have unique sort values
    const allStats = this.actor.items.filter(i => i.type === 'stat');
    await this._ensureUniqueSortValues(allStats);
    
    // Re-fetch stats after ensuring unique sort values
    const sortedStats = this.actor.items.filter(i => i.type === 'stat').sort((a, b) => {
      const sortA = a.system.sort || 0;
      const sortB = b.system.sort || 0;
      if (sortA !== sortB) return sortA - sortB;
      return a.name.localeCompare(b.name);
    });
    
    const currentIndex = sortedStats.findIndex(s => s.id === itemId);
    
    if (currentIndex >= sortedStats.length - 1) {
      return; // Already at bottom
    }
    
    const currentItem = sortedStats[currentIndex];
    const nextStat = sortedStats[currentIndex + 1];
    const currentSort = currentItem.system.sort || 0;
    const nextSort = nextStat.system.sort || 0;
    
    // Swap sort values
    await currentItem.update({"system.sort": nextSort});
    await nextStat.update({"system.sort": currentSort});
  }

  /**
   * Handle damage box clicks - LÓGICA FINAL
   */
  _onSquareCounterChange(event) {
    event.preventDefault();
    
    const element = event.currentTarget;
    const index = Number(element.dataset.index);
    const parent = $(element.parentNode);
    const data = parent[0].dataset;
    const itemID = data.name;
    const maxBoxes = Number(data.max);
    const steps = parent.find('.resource-counter-step');
    
    let currentShock = Number(data.shock) || 0;
    let currentKilling = Number(data.killing) || 0;
    
    // Determine current state of clicked box
    let currentState = '';
    if (index < currentKilling) {
      currentState = 'x';
    } else if (index < (currentKilling + currentShock)) {
      currentState = '/';
    } else {
      currentState = '';
    }
    
    // Calculate new totals
    let newShock = currentShock;
    let newKilling = currentKilling;
    
    if (currentState === '') {
      newShock++;
    } else if (currentState === '/') {
      newShock--;
      newKilling++;
    } else if (currentState === 'x') {
      newKilling--;
    }
    
    // Enforce limits
    newShock = Math.max(0, Math.min(newShock, maxBoxes));
    newKilling = Math.max(0, Math.min(newKilling, maxBoxes));
    
    if (newShock + newKilling > maxBoxes) {
      if (currentState === '') {
        newShock = maxBoxes - newKilling;
      }
    }
    
    // Update data
    data.shock = newShock;
    data.killing = newKilling;
    
    // Update display
    this._updateCounterDisplay(parent, newShock, newKilling, maxBoxes);
    
    // Save to actor
    this._assignToActorField(itemID, {
      shock: newShock,
      killing: newKilling
    });
  }

  /**
   * Update visual display: Killing → Shock → Empty (left to right)
   */
  _updateCounterDisplay(parent, shock, killing, maxBoxes) {
    const steps = parent.find('.resource-counter-step');
    
    steps.each(function(index) {
      const step = this;
      let state = '';
      let content = '';
      
      if (index < killing) {
        state = 'x';
        content = '×';
      } else if (index < (killing + shock)) {
        state = '/';
        content = '/';
      } else {
        state = '';
        content = '☐';
      }
      
      step.dataset.state = state;
      step.innerHTML = content;
    });
  }

  /**
   * Setup initial counter display
   */
  _setupSquareCounters(html) {
    html.find('.resource-counter').each(function () {
      const data = this.dataset;
      const shock = Number(data.shock) || 0;
      const killing = Number(data.killing) || 0;
      const maxBoxes = Number(data.max) || 0;
      
      $(this).find('.resource-counter-step').each(function (index) {
        let state = '';
        let content = '';
        
        if (index < killing) {
          state = 'x';
          content = '×';
        } else if (index < (killing + shock)) {
          state = '/';
          content = '/';
        } else {
          state = '';
          content = '☐';
        }
        
        this.dataset.state = state;
        this.innerHTML = content;
      });
    });
  }

  /**
   * Save to actor
   */
  _assignToActorField(itemID, value) {
    const actorData = foundry.utils.duplicate(this.actor);
    
    for (const item of actorData.items) {
      if (itemID === item._id) {
        item.system.shock = value.shock;
        item.system.killing = value.killing;
        break;
      }
    }

    this.actor.update(actorData);
  }

  /**
   * Create a new item with default values for hit locations and weapons
   */
  async _onItemCreate(event) {
    event.preventDefault();
    const header = event.currentTarget;
    const type = header.dataset.type;
    
    let data = foundry.utils.duplicate(header.dataset);
    let name = `New ${type.capitalize()}`;
    
    // Valores padrão específicos para hit locations
    if (type === 'hitloc') {
      // Encontra o próximo range disponível
      const existingHitlocs = this.actor.items.filter(i => i.type === 'hitloc');
      let nextStart = 1;
      
      if (existingHitlocs.length > 0) {
        const maxEnd = Math.max(...existingHitlocs.map(h => h.system.noEnd || 0));
        nextStart = maxEnd + 1;
      }
      
      name = `Hit Location ${nextStart}`;
      data = {
        name: `Location ${nextStart}`,
        noStart: nextStart,
        noEnd: nextStart,
        max: 5,
        shock: 0,
        killing: 0
      };
    }

    // Valores padrão específicos para weapons
    if (type === 'weapon') {
      name = `New Weapon`;
      data = {
        subtype: "melee",
        attack: {
          skill: "",
          stat: "",
          dicebonus: 0,
          edbonus: 0,
          mdbonus: 0
        },
        parry: {
          skill: "",
          stat: "",
          dicebonus: 0,
          edbonus: 0,
          mdbonus: 0
        },
        dodge: {
          skill: "",
          stat: "",
          dicebonus: 0,
          edbonus: 0,
          mdbonus: 0
        },
        damage: {
          main: {
            formula: "width",
            type: "killing"
          },
          alt: {
            formula: "",
            type: ""
          },
          additional: []
        },
        traits: [],
        ammunition: {
          current: 0,
          max: 0,
          type: ""
        },
        range: {
          short: 0,
          medium: 0,
          long: 0
        }
      };
    }

    // Set default sort for stats
    if (type === 'stat') {
      const existingStats = this.actor.items.filter(i => i.type === 'stat');
      const maxSort = existingStats.length > 0 ? Math.max(...existingStats.map(s => s.system.sort || 0)) : 0;
      data.sort = maxSort + 1;
    }
    
    const itemData = {
      name: name,
      type: type,
      system: data
    };
    
    delete itemData.system["type"];

    return await Item.create(itemData, { parent: this.actor });
  }

  async _onRoll(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const dataset = element.dataset;

    if (dataset.rollType) {
      if (dataset.rollType == 'item') {
        const itemId = element.closest('.item').dataset.itemId;
        const item = this.actor.items.get(itemId);
        if (item) {
          // Check if Ctrl+click for advanced dialog
          if (event.ctrlKey) {
            return this._showAdvancedRollDialog(item);
          } else {
            return item.roll();
          }
        }
      }
    }

    if (dataset.roll) {
      let label = dataset.label ? `[roll] ${dataset.label}` : '';
      let roll = new Roll(dataset.roll, this.actor.getRollData());
      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: label,
        rollMode: game.settings.get('core', 'rollMode'),
      });
      return roll;
    }
  }

  /**
   * Show advanced roll dialog
   */
  async _showAdvancedRollDialog(item) {
    const stats = this.actor.items.filter(i => i.type === 'stat');
    const targets = Array.from(game.user.targets);
    
    // Get current linked stat
    let linkedStat = null;
    if (item.type === 'skill' && item.system.stat) {
      linkedStat = this.actor.items.getName(item.system.stat);
    }

    // Calculate base dice pools
    let baseDice = item.system.d || 0;
    let baseED = item.system.ed || 0;
    let baseMD = item.system.md || 0;
    let baseEDSet = item.system.ed_set || 10;

    if (linkedStat && item.type === 'skill') {
      baseDice += linkedStat.system.d || 0;
      baseED += linkedStat.system.ed || 0;
      baseMD += linkedStat.system.md || 0;
    }

    const dialogContent = await renderTemplate("systems/oresystem/templates/dialogs/advanced-roll-dialog.html", {
      item: item,
      stats: stats,
      targets: targets,
      linkedStat: linkedStat,
      baseDice: baseDice,
      baseED: baseED,
      baseMD: baseMD,
      baseEDSet: baseEDSet,
      difficulty: this.actor.system.difficulty || 0,
      penalty: 0 // Always start with 0 penalty in dialog
    });

    return new Promise((resolve) => {
      new Dialog({
        title: `Advanced Roll: ${item.name}`,
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
              this._executeAdvancedRoll(item, data);
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
            this._updateTotalDice(html, item, stats);
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
  _updateTotalDice(html, item, stats) {
    const formData = new FormData(html[0].querySelector("form"));
    const data = {};
    for (let [key, value] of formData.entries()) {
      data[key] = value;
    }

    let totalDice = parseInt(item.system.d) || 0;
    let totalED = parseInt(item.system.ed) || 0;
    let totalMD = parseInt(item.system.md) || 0;

    // Add linked stat if different from original
    const newLinkedStatName = data.linkedStat || item.system.stat;
    if (newLinkedStatName && item.type === 'skill') {
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

    const edSet = data.edSet || item.system.ed_set || 10;

    html.find('#totalDiceDisplay').text(`Total: ${finalDice}d ${finalED}e${edSet} ${finalMD}m`);
  }

  /**
   * Execute the advanced roll with custom parameters
   */
  async _executeAdvancedRoll(item, rollData) {
    const ORE = game.oneRollEngine;

    // Calculate final dice pools
    let totalDice = parseInt(item.system.d) || 0;
    let totalED = parseInt(item.system.ed) || 0;
    let totalMD = parseInt(item.system.md) || 0;

    // Add linked stat
    const linkedStatName = rollData.linkedStat || item.system.stat;
    if (linkedStatName && item.type === 'skill') {
      const linkedStat = this.actor.items.getName(linkedStatName);
      if (linkedStat) {
        totalDice += parseInt(linkedStat.system.d) || 0;
        totalED += parseInt(linkedStat.system.ed) || 0;
        totalMD += parseInt(linkedStat.system.md) || 0;
      }
    }

    // Add modifiers
    totalDice += rollData.diceModifier || 0;
    totalED += rollData.edModifier || 0;
    totalMD += rollData.mdModifier || 0;

    // Ensure minimums
    totalDice = Math.max(1, totalDice);
    totalED = Math.max(0, totalED);
    totalMD = Math.max(0, totalMD);

    const edSet = rollData.edSet || item.system.ed_set || 10;
    const difficulty = rollData.difficulty !== undefined ? rollData.difficulty : (this.actor.system.difficulty || 0);
    const penalty = rollData.penalty !== undefined ? rollData.penalty : 0; // Use only dialog penalty

    // Build flavor text
    let flavorParts = [item.name];
    
    if (rollData.linkedStat && rollData.linkedStat !== item.system.stat) {
      flavorParts.push(`(using ${rollData.linkedStat})`);
    }
    
    if (rollData.diceModifier || rollData.edModifier || rollData.mdModifier) {
      const modifiers = [];
      if (rollData.diceModifier) modifiers.push(`${rollData.diceModifier > 0 ? '+' : ''}${rollData.diceModifier}d`);
      if (rollData.edModifier) modifiers.push(`${rollData.edModifier > 0 ? '+' : ''}${rollData.edModifier}e`);
      if (rollData.mdModifier) modifiers.push(`${rollData.mdModifier > 0 ? '+' : ''}${rollData.mdModifier}m`);
      if (modifiers.length > 0) {
        flavorParts.push(`[${modifiers.join(' ')}]`);
      }
    }

    // Add target information if available
    const targets = Array.from(game.user.targets);
    if (targets.length > 0) {
      const targetNames = targets.map(t => t.name).join(', ');
      flavorParts.push(`→ ${targetNames}`);
    }

    if (rollData.customFlavor) {
      flavorParts.push(`- ${rollData.customFlavor}`);
    }

    const flavorText = flavorParts.join(' ');

    // Create ORE command string
    const str = `/ore ${totalDice}d ${totalED}e${edSet} dif ${difficulty} pen ${penalty} md ${totalMD} # ${flavorText}`;

    // Execute the roll
    let fakeData = {
      content: '',
      type: CONST.CHAT_MESSAGE_TYPES.OTHER,
      rolls: [],
      flags: { core: { canPopout: true } }
    };

    await ORE.rollFromChatMessageOreCommand(str, fakeData);
  }
}
// Import document classes.
import { ReignActor } from "./documents/actor.mjs";
import { ReignItem } from "./documents/item.mjs";
// Import sheet classes.
import { ReignActorSheet } from "./sheets/actor-sheet.mjs";
import { ReignItemSheet } from "./sheets/item-sheet.mjs";
// Import helper/utility classes and constants.
import { preloadHandlebarsTemplates } from "./helpers/templates.mjs";
import { ORESYSTEM } from "./helpers/config.mjs";

/* -------------------------------------------- */
/*  Init Hook                                   */
/* -------------------------------------------- */

Hooks.once('init', async function() {

  // Add utility classes to the global game object so that they're more easily
  // accessible in global contexts.
  game.oresystem = {
    ReignActor,
    ReignItem
  };

  // Add custom constants for configuration.
  CONFIG.ORESYSTEM = ORESYSTEM;

  /**
   * Set an initiative formula for the system
   * @type {String}
   */
  CONFIG.Combat.initiative = {
    formula: "100/(actor.items.getName(\"Sense\").system.d + 2 * actor.items.getName(\"Sense\").system.ed + 4 * actor.items.getName(\"Sense\").system.md)",
    decimals: 0
  };

  // Define custom Document classes
  CONFIG.Actor.documentClass = ReignActor;
  CONFIG.Item.documentClass = ReignItem;

  // Register sheet application classes
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("oresystem", ReignActorSheet, { makeDefault: true });
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("oresystem", ReignItemSheet, { makeDefault: true });

  // Preload Handlebars templates.
  return preloadHandlebarsTemplates();
});

/* -------------------------------------------- */
/*  Handlebars Helpers                          */
/* -------------------------------------------- */

Handlebars.registerHelper('concat', function() {
  var outStr = '';
  for (var arg in arguments) {
    if (typeof arguments[arg] != 'object') {
      outStr += arguments[arg];
    }
  }
  return outStr;
});

Handlebars.registerHelper('toLowerCase', function(str) {
  return str.toLowerCase();
});

Handlebars.registerHelper('numLoop', function (num, options) {
  if (typeof options === 'undefined' || typeof options.fn !== 'function') {
    console.error('numLoop helper: invalid options parameter');
    return '';
  }
  
  const numValue = parseInt(num);
  if (isNaN(numValue) || numValue <= 0) {
    return '';
  }
  
  let ret = '';
  for (let i = 0; i < numValue; i++) {
    ret += options.fn(i);
  }
  
  return new Handlebars.SafeString(ret);
});

Handlebars.registerHelper('lessThan', function(num1, num2) {
  const n1 = parseInt(num1) || 0;
  const n2 = parseInt(num2) || 0;
  return Math.max(0, n2 - n1);
});

Handlebars.registerHelper('subtract', function(num1, num2) {
  const n1 = parseInt(num1) || 0;
  const n2 = parseInt(num2) || 0;
  return Math.max(0, n1 - n2);
});

// NOVOS HELPERS PARA O SISTEMA DE DANO

Handlebars.registerHelper('add', function(a, b) {
  return (parseInt(a) || 0) + (parseInt(b) || 0);
});

Handlebars.registerHelper('eq', function(a, b) {
  return a === b;
});

Handlebars.registerHelper('gt', function(a, b) {
  return (parseInt(a) || 0) > (parseInt(b) || 0);
});

Handlebars.registerHelper('gte', function(a, b) {
  return (parseInt(a) || 0) >= (parseInt(b) || 0);
});

Handlebars.registerHelper('lt', function(a, b) {
  return (parseInt(a) || 0) < (parseInt(b) || 0);
});

Handlebars.registerHelper('lte', function(a, b) {
  return (parseInt(a) || 0) <= (parseInt(b) || 0);
});

// Helper para verificar se há dano total
Handlebars.registerHelper('hasDamage', function(shock, killing) {
  return ((parseInt(shock) || 0) + (parseInt(killing) || 0)) > 0;
});

Handlebars.registerHelper('and', function(a, b) {
  return a && b;
});

Handlebars.registerHelper('or', function(a, b) {
  return a || b;
});

// Helper para calcular caixas livres
Handlebars.registerHelper('freeBoxes', function(max, shock, killing) {
  const maxVal = parseInt(max) || 0;
  const shockVal = parseInt(shock) || 0;
  const killingVal = parseInt(killing) || 0;
  return Math.max(0, maxVal - shockVal - killingVal);
});

// Helper para verificar se uma caixa está em um estado específico
Handlebars.registerHelper('boxState', function(index, shock, killing) {
  const idx = parseInt(index) || 0;
  const shockVal = parseInt(shock) || 0;
  const killingVal = parseInt(killing) || 0;
  
  if (idx < killingVal) {
    return 'x'; // Killing
  } else if (idx < (shockVal + killingVal)) {
    return '/'; // Shock
  } else {
    return ''; // Vazio
  }
});

// Helper para debug (útil durante desenvolvimento)
Handlebars.registerHelper('debug', function(value) {
  console.log('Debug Handlebars:', value);
  return '';
});

// Helper para verificar se um valor existe e não está vazio
Handlebars.registerHelper('isNotEmpty', function(value) {
  return value !== null && value !== undefined && value !== '';
});

// Helper para formatação de números
Handlebars.registerHelper('formatNumber', function(value, decimals = 0) {
  const num = parseFloat(value) || 0;
  return num.toFixed(decimals);
});

// Helper para capitalizar primeira letra
Handlebars.registerHelper('capitalize', function(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
});

// Helper para verificar se é o primeiro item de uma lista
Handlebars.registerHelper('isFirst', function(index) {
  return parseInt(index) === 0;
});

// Helper para verificar se é o último item de uma lista
Handlebars.registerHelper('isLast', function(index, array) {
  return parseInt(index) === (array.length - 1);
});

// Helper para criar ranges de números (útil para hit locations)
Handlebars.registerHelper('range', function(start, end, options) {
  let result = '';
  const startNum = parseInt(start) || 0;
  const endNum = parseInt(end) || 0;
  
  for (let i = startNum; i <= endNum; i++) {
    result += options.fn(i);
  }
  return result;
});

// Helper condicional avançado
Handlebars.registerHelper('ifCond', function(v1, operator, v2, options) {
  switch (operator) {
    case '==': return (v1 == v2) ? options.fn(this) : options.inverse(this);
    case '===': return (v1 === v2) ? options.fn(this) : options.inverse(this);
    case '!=': return (v1 != v2) ? options.fn(this) : options.inverse(this);
    case '!==': return (v1 !== v2) ? options.fn(this) : options.inverse(this);
    case '<': return (v1 < v2) ? options.fn(this) : options.inverse(this);
    case '<=': return (v1 <= v2) ? options.fn(this) : options.inverse(this);
    case '>': return (v1 > v2) ? options.fn(this) : options.inverse(this);
    case '>=': return (v1 >= v2) ? options.fn(this) : options.inverse(this);
    case '&&': return (v1 && v2) ? options.fn(this) : options.inverse(this);
    case '||': return (v1 || v2) ? options.fn(this) : options.inverse(this);
    default: return options.inverse(this);
  }
});

// NOVOS HELPERS PARA WEAPONS

// Helper para juntar arrays em strings
Handlebars.registerHelper('join', function(array, separator) {
  if (!Array.isArray(array)) {
    return '';
  }
  return array.join(separator || ', ');
});

// Helper para verificar se uma string está em um array
Handlebars.registerHelper('includes', function(array, value) {
  if (!Array.isArray(array)) {
    return false;
  }
  return array.includes(value);
});

// Helper para obter o primeiro elemento de um array
Handlebars.registerHelper('first', function(array) {
  if (!Array.isArray(array) || array.length === 0) {
    return null;
  }
  return array[0];
});

// Helper para obter o último elemento de um array
Handlebars.registerHelper('last', function(array) {
  if (!Array.isArray(array) || array.length === 0) {
    return null;
  }
  return array[array.length - 1];
});

// Helper para calcular o comprimento de um array
Handlebars.registerHelper('length', function(array) {
  if (!Array.isArray(array)) {
    return 0;
  }
  return array.length;
});

// Helper para verificar se um array está vazio
Handlebars.registerHelper('isEmpty', function(array) {
  if (!Array.isArray(array)) {
    return true;
  }
  return array.length === 0;
});

// Helper para filtrar arrays (útil para weapon traits)
Handlebars.registerHelper('filter', function(array, property, value, options) {
  if (!Array.isArray(array)) {
    return '';
  }
  
  const filtered = array.filter(item => {
    if (typeof item === 'object' && item[property]) {
      return item[property] === value;
    }
    return item === value;
  });
  
  let result = '';
  for (let i = 0; i < filtered.length; i++) {
    result += options.fn(filtered[i]);
  }
  return result;
});

// Helper para verificar se um weapon é ranged
Handlebars.registerHelper('isRanged', function(weapon) {
  return weapon && weapon.system && weapon.system.subtype === 'ranged';
});

// Helper para verificar se um weapon é melee
Handlebars.registerHelper('isMelee', function(weapon) {
  return weapon && weapon.system && weapon.system.subtype === 'melee';
});

/* -------------------------------------------- */
/*  Ready Hook                                  */
/* -------------------------------------------- */

Hooks.once("ready", async function() {
  // Migrate existing stats to add sort field
  console.log("ORE System | Checking for stat migration...");
  
  try {
    for (let actor of game.actors) {
      if (actor.type === 'character' || actor.type === 'npc') {
        const stats = actor.items.filter(i => i.type === 'stat');
        if (stats.length === 0) continue;
        
        let needsUpdate = false;
        const updates = [];
        
        // Check if any stats are missing sort values or have duplicates
        const sortValues = stats.map(s => s.system.sort || null);
        const hasUndefined = sortValues.some(v => v === null || v === undefined);
        const hasDuplicates = sortValues.length !== new Set(sortValues.filter(v => v !== null)).size;
        
        if (hasUndefined || hasDuplicates) {
          console.log(`ORE System | Migrating stats for actor ${actor.name}`);
          
          // Sort stats by name for consistent ordering
          const sortedStats = [...stats].sort((a, b) => a.name.localeCompare(b.name));
          
          // Assign sequential sort values
          for (let i = 0; i < sortedStats.length; i++) {
            updates.push({
              _id: sortedStats[i].id,
              'system.sort': i
            });
            needsUpdate = true;
          }
        }
        
        if (needsUpdate) {
          console.log(`ORE System | Updating ${updates.length} stats for actor ${actor.name}`);
          await actor.updateEmbeddedDocuments('Item', updates);
        }
      }
    }
    
    console.log("ORE System | Stat migration complete");
  } catch (error) {
    console.error("ORE System | Migration error:", error);
  }
});
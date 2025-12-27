# Generator tools


## Generator tools

In various places, there are mechanics that rely on ad-hoc creation of things, poems,
creatures, etc. This would normally be prohibitively slowing down the game flow. We use
generators to offset this issue.

#### Study

##### LLM Integration for References

###### Generating Source Books

(actually sources might not only be books - maybe some are alive? Or rocks. Or other stuff)

When players discover/acquire references:

```
● Context: [Location/source of book]
● Topic area: [What it covers]
● Quality level: [Authoritative/Standard/Questionable]
● Generate: Book title, author, and table of contents
```
Example output:

```
● "The Cultivator's Companion to Void-Touched Flora"
● By Scholar Yevrin Moss-Tongue (Third Edition)
●
● Table of Contents:
● 1. Safety Protocols for Void Exposure
● 2. Identifying Gravitational Adaptations
● 3. Common Symbiotic Relationships
● 4. Harvesting During Flux Variations
● 5. Storage of Unstable Specimens
● 6. Index of Known Mutations
● Appendix: Emergency Decontamination
●
● Quality: Authoritative for void flora, Standard for general biology
● Condition: Moss-grown binding (ironically), some pages stick together
```
###### Generating Research Results

For specific queries:

```
● Research question: [What player asks]
```

```
● Source used: [Reference book/material]
● Match level: [Perfect/Good/Stretch/Wild]
● Success level: [Failed/Success/Critical]
● Generate: Information discovered
```
This allows dynamic, surprising research discoveries while maintaining consistency.

**Authoritative Sources** :

```
● Original texts, direct observations, primary documents
● Scholar's personal notes on their expertise
● Living specimens for biological research
```
**Standard References** :

```
● Good secondary sources, established textbooks
● Recent travel guides, current maps
● Maintained databases or libraries
```
**Questionable Sources** :

```
● Outdated materials, translations of translations
● Gossip, hearsay, personal opinions
● Damaged or partially destroyed texts
```
###### Physical References

###### Example References

```
● "Grandfather's Migration Charts"
● - Enables: Navigation research for this star cluster
● - Quality: Authoritative for known routes, Standard for variations
● - Condition: Fragile, water-damaged sections illegible
●
● "Handbook of Lesser Planets"
● - Enables: Research on planetary phenomena
● - Quality: Standard for established worlds
● - Condition: Heavy (2x3 grid spaces)
●
● "Whispers and Rumors of the Port"
● - Enables: Social/political research
● - Quality: Questionable but current
● - Condition: Needs constant updates or becomes useless
```

#### Weave

###### Poem generation

Prompt content:

```
● Ordering of syllables
● Distance aspect
● More definition/options for each syllable
● Higher quality embodiment modificators
● Complexity guide
● Good variety of effects/poems (e.g. supportive as well as destructive etc)
● What makes the poem good
● Character's take on & mode of interaction with the arcane
```
#### Socialize

##### Snippets

```
Examples
```
```
● "Values tradition" → Double value when appealing to customs
● "Secret gambling debts" → Enables leverage approach
● "Lost daughter to plague" → Avoid mentioning children
● "Ambitious but cautious" → Frame proposals as safe advancement
```
#### Crafting

**LLM Integration Potential**

Generation prompt structure:

Environment: [Current location details]
Flux Phase: [Current phase]
Tags sought: [Player-declared tags]
Success Level: [Roll result]
Generate specimen with name, tags, description, abundance, and shape




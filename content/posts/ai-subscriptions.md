---
title: "Subscripciones de IA for DEVs"
date: 2026-06-18T23:55:34+01:00
draft: true
tags: ["AI", "money", "investment","dev"]
categories: ["blog"]
---

Llevamos con la IA generativa ya un tiempo y desde entonces es comun comentar
con mis compañeros de profesion como avanzan los LLMs en programacion Agentica.
Me preguntan mucho y yo tambien voy preguntando a cada persona que me encuentro,
por algun casual solo suelo conocer personas del sector, como usan la IA, si sus
empresas les permiten usarlas o le pagan la subscripción.

Para servir de guia y para plasmar lo que pienso voy a escribir este post en el que
vamos comparar las diferentes subscripciones de AI que disponibles, tambien consejos
y algunas reflexiones finales.

## TLDR

La lista de modelos y subscripciones de este post probablemente quede obsoleta dentro de unos meses. Mantenerse actualizado requiere tiempo.
En mi opinion, lo mejor es no casarse con ninguna compañia o modelo e ir surfeando la ola conforme viene.

## Modelos

Mirando un ranking de modelos <https://www.vals.ai/benchmarks/swebench> podemos ver que los modelos TOP, y mas caros, son los de Claude deAntropic, GPT de OpenAI y Gemini de Google.
Despues vendrian los modelos de empresas chinas como GLM, DeepSeek, MiMo, MiniMax o Qwen a precios mas reducidos.
Para que nos hagamos una idea, los modelos de empresas chinas van retrasados unos 6 meses respecto a los de Claude o GPT, ¿quiza porque son, en parte, versiones destiladas de otros modelos mejores?

En mi experiencia, con usar un modelos que superen el 70% del SWE benchmark es suficiente para tener una experiencia de programacion agradable con IA.
Obviamente a mas potente sea el modelo mejor, podremos dejarle escribir tareas mas extensas
con menos errors. Notece el uso de "dejarle escribir" y no usar otros verbos como confiar, delegar, dejarle hacer. A mayor sea la tarea mayor la "deuda cognitiva" y mas dificil se hace el revisar el código en detalle.
Mi forma de trabajar hasta ahora es intentar darle al agente tareas cortas lo mas acotadas posibles y revisar cada linea cambiada. Tambien lo uso mucho para revisar codigo y detectar posibles problemas.

## Herramientas Agenticas

### IDE

Simplemente la IA integrada en el IDE, tienes una ventana/panel de chat donde preguntas y vas pidiendo cambios y los ves reflejados en el editor.

Dentro de esta categoría tenemos

* **Visual Studio Code (VSC)** → Con GitHub Copilot extension tienes agent mode, CLI y multiples modelos. Free con limites, Pro $10/mes
* **Cursor** → Fork de VSC con IA nativa. Modo agente muy pulido, cloud agents, Bugbot para code review. Pro $20/mes, Teams $40/user/mes
* **Codex** → De OpenAI. IDE en la web para que el agente trabaje de forma autonoma en tareas de coding. Incluido en ChatGPT Plus ($20/mes) con uso expandido
* **Devin Desktop (ex-Windsurf)** → De Cognition. Antes Windsurf. Agentes cloud, modelo SWE 1.6 propio. Free con limites, Pro $20/mes, Max $200/mes
* **Trae** → De ByteDance. Modo SOLO (agente agil). Free con limites, Pro $10/mes, Pro+ $30/mes, Ultra $100/mes

### CLI

Podemos usar los agentes de IA desde una terminal. Curiosamente los agentes funcionan mejor de esta forma.

* **Claude Code** → De Anthropic. Agente CLI nativo de Claude. Incluido en la suscripcion Pro ($20/mes), requiere cuenta de Anthropic
* **GitHub CLI** → Extension `gh copilot` para usar Copilot desde terminal. Incluido en Copilot Pro ($10/mes)
* **OpenCode** → Open source y gratuito. Funciona con cualquier proveedor via API keys, Zen (pay-as-you-go) o Go ($10/mes). Desktop app disponible
* **Crush** → Agente CLI de coding. Alternativa emergente en el espacio de agentes de terminal 

## Suscripciones

La tabla muestra el plan minimo que incluye acceso a coding agentic y su precio mensual.

| Servicio               | Plan agentic   | Precio ($/mes) | Tipo          | Observaciones |
|------------------------|----------------|----------------|---------------|---------------------------------------------------------|
| Claude (Anthropic)     | Pro            | $20            | Claude Code   | Incluye Claude Code, Cowork y Design. Uso limitado |
| ChatGPT (OpenAI)       | Plus           | $20            | CLI           | Incluye Codex con uso expandido y modo agente |
| GitHub Copilot         | Pro            | $10            | IDE + CLI     | El mas barato con agentic completo |
| Cursor                 | Pro            | $20            | IDE           | Modo agente con buena integracion IDE |
| OpenCode Go            | Go             | $10/mes        | CLI + Desktop | $5 el primer mes. Modelos open source (GLM-5.1, DeepSeek V4, etc) |
| Trae                   | Pro            | $10            | IDE           | De ByteDance. Modo SOLO (agente) |
| Devin Desktop (ex-Windsurf) | Pro       | $20            | IDE           | Antes Windsurf. Cloud agents, modelo SWE 1.6 |
| Google AI Plus         | Plus           | ~$22           | API + CLI     | Incluye Jules (agente coding) |

## Reflexiones

* Las condiciones cambian, no compres una subscripcion anual.
* Intenta hacer tu proyecto agnostico del modelo y del IDE que uses.
* Las IAs locales empiezan a ser realmente utiles si tienes suficiente memoria de video, con 16GB es suficiente.
* Cuidado con los nuevos vectores y superficie de ataque. Las skills pese a hacer un ficher markdown puede ser peligroso. Las dependencias tambien.
* Es muy comodo usar siempre el modelo mas potente pero es caro. Ajusta el modelo a la tarea
* Si quieres aprender algo, yo directamente intentaría empezar a hacer con ayuda de una buena subscripcion de IA en vez de comprar un curso, especialmente si es muy caro o largo.
* Es posible que el precio de los modelos frontera siga subiendo pero los precios de los modelos que actualmente hacen un buen papel generando codigo bajen.

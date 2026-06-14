---
title: "Suscripciones de IA for DEVs"
date: 2026-06-18T23:55:34+01:00
draft: true
tags: ["AI", "money", "investment", "dev"]
categories: ["blog"]
---

Llevamos ya un tiempo con la IA generativa y desde entonces es común comentar
con mis compañeros de profesión como avanzan los LLMs en programación Agéntica.
Me preguntan mucho y yo también voy preguntando a cada persona que me encuentro,
por algún casual solo suelo conocer personas del sector, como usan la IA, si sus
empresas les permiten usarlas o le pagan la suscripción.

Para servir de guía y para plasmar lo que pienso voy a escribir este post en el que
vamos a comparar las diferentes suscripciones de IA disponibles, también consejos
y algunas reflexiones finales.

## TL;DR

La lista de modelos y suscripciones de este post probablemente quede obsoleta dentro de unos meses. Mantenerse actualizado requiere tiempo.
En mi opinión, lo mejor es no casarse con ninguna compañía o modelo e ir surfeando la ola conforme viene.

## Modelos

Mirando un ranking de modelos <https://www.vals.ai/benchmarks/swebench> podemos ver que los modelos TOP, y más caros, son los de Claude de Anthropic, GPT de OpenAI y Gemini de Google.
Después vendrían los modelos de empresas chinas como GLM, DeepSeek, MiMo, MiniMax o Qwen a precios más reducidos.
Para que nos hagamos una idea, los modelos chinos suelen ir algo por detrás de los modelos punteros de Anthropic y OpenAI, ¿Pueden ser en parte versiones destiladas de otros modelos mejores? Es posible, aunque también cabe pensar que la competencia empuja a todos a mejorar rápido.

En mi experiencia, cualquier modelo que supere aproximadamente el 70 % en SWE-bench ya ofrece una experiencia de programación cómoda en modo Agente.
Obviamente a más potente sea el modelo mejor, podremos dejarle escribir tareas más extensas
con menos errores. Nótese el uso de "dejarle escribir" y no usar otros verbos como confiar, delegar, dejarle hacer. Cuanto mayor sea la tarea, mayor la "deuda cognitiva" y más difícil se hace el revisar el código en detalle.
Mi forma de trabajar hasta ahora es intentar darle al agente tareas cortas lo más acotadas posible y revisar cada línea cambiada. También lo uso mucho para revisar código y detectar posibles problemas.

## Herramientas Agénticas para desarrolladores

Este tipo de herramientas permiten a los modelos de IA actuar. Podrían por ejemplo buscar ficheros en un ordenador, leer, escribir, ejecutar programas o consultar información por internet.
Listo los más conocidos para que tengamos algo de contexto. Seguro que hay más pero el objetivo de este post no es listarlas todas.

### IDE

Simplemente la IA integrada en el IDE, tienes una ventana/panel de chat donde preguntas, vas pidiendo cambios y los ves reflejados en el editor.
Dentro de esta categoría tenemos. Muchos tienen una capa gratuita para uso Agéntico.

* **Visual Studio Code (VSC)** → Se integra con Github Copilot
* **Cursor** → Fork de VSC con IA nativa. Modo agente, cloud agents, Bugbot para revisión de código
* **Codex** → De OpenAI. IDE en la web para que el agente trabaje de forma autónoma en tareas de programación
* **Devin Desktop (ex-Windsurf)** → Anteriormente conocido como Windsurf. Agentes cloud, modelo SWE 1.6 propio
* **Trae** → De ByteDance. Modo SOLO

### CLI

Podemos usar los agentes de IA desde una terminal. Curiosamente los agentes funcionan mejor de esta forma, quizá porque el entorno de texto plano elimina la distracción de una interfaz gráfica y obliga a expresar las instrucciones con mayor precisión.

* **Claude Code** → CLI de Anthropic para programar. Es de las más utilizadas. Es compatible con terceros.
* **GitHub CLI** → De Microsoft
* **Codex CLI** → De OpenAI
* **OpenCode** → Open source y gratuito. Funciona con cualquier proveedor vía API keys, Zen (pay-as-you-go) o Go ($10/mes)
* **Crush** → Otra CLI para programar con Agentes. Alternativa hecha en Go.

## Suscripciones

Desde hace unos meses las suscripciones de IA vienen subiendo de precio y/o reduciendo quota de forma drástica.
Justo este mes, junio de 2026, han cambiado las condiciones y la suscripción de GitHub Copilot que venía usando.
Ha pasado de ser la mejor calidad precio a la peor. Ahora estoy probando OpenCode Go, no creo que llegue a agotar la cuota.

### Suscripciones de entrada

La tabla muestra el plan mínimo que incluye acceso a agentes de código

| Servicio           | Plan         | Precio (€/mes) | Tipo                       | Quota* | Observaciones |
|--------------------|--------------|----------------|----------------------------|--------|------------------------------------------------|
| Claude (Anthropic) | Pro          | 20€            | Web + Desktop + CLI        | Justa  | No compatible con herramientas de terceros   |
| ChatGPT (OpenAI)   | Plus         | 20€            | Web + IDE Extensions + CLI | Justa  | No compatible con herramientas de terceros   |
| GitHub Copilot     | Pro          | 10€            | IDE + CLI                  | No     | Ligada a VSC. Incluye autocompletados y revisión de código en GitHub |
| Cursor             | Pro          | 20€            | IDE                        | Justa  | Modo agente con buena integración con su IDE |
| OpenCode Go        | Go           | 10€            | CLI + Desktop + API        | Sí     | $5 el primer mes. Modelos open source (GLM-5.1, DeepSeek V4, etc) |
| Trae               | Pro          | 10€            | IDE                        | Justa  | No compatible con herramientas de terceros   |
| Devin Desktop      | Pro          | 20€            | IDE                        | No     | Antes Windsurf |
| Google AI Plus     | Plus         | 22€            | API + Jules + Antigravity  | Justa  | Incluye Jules y Antigravity |

* Quota: La suscripción incluye suficientes tokens/peticiones como para que un desarrollador pueda usarla durante un mes sin agotarla por completo

También hay servicios que ofrecen una cantidad bastante limitada de peticiones/tokens de forma gratuita. No he visto ninguno de estos servicios que digan que no vayan a usar los datos para sus propios fines. Mucho cuidado con los ficheros .env

## Reflexiones

* Las condiciones cambian, no compres una suscripción anual.
* Intenta hacer tu proyecto agnóstico del modelo y del IDE que uses.
* Para uso local, 16 GB de VRAM ya permiten trabajar con modelos interesantes
* Cuidado con los nuevos vectores y superficie de ataque. Las skills, pese a generar un fichero Markdown, pueden ser peligrosas. Las dependencias también pueden serlo.
* Es muy cómodo usar siempre el modelo más potente pero es caro. Ajusta el modelo a la tarea
* Si quieres aprender algo, yo directamente intentaría empezar a construirlo con ayuda de una buena suscripción de IA en vez de comprar un curso, especialmente si es muy caro o largo.
* Es posible que el precio de los modelos frontera siga subiendo pero los precios de los modelos que actualmente hacen un buen papel generando código bajen.

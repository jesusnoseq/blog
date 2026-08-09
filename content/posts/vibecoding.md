---
title: "Vibecoding"
date: 2026-08-08T23:55:34+01:00
draft: false
tags: ["AI", "games", "webxr", "dev","vibecoding", "babylonjs"]
categories: ["blog"]
---

Hace un par de semanas empecé el proyecto de <https://fuboh.com> haciendo vibecoding en mis ratos libres. En la primera semana ya tenia algo jugable online y la segunda ha sido de mejoras. Aún le podría dedicar otra semana más a dejarlo de verdad pulido.

Actualmente el juego permite echar unas partidas de futbolin con teclado (no recomendable), gamepad y VR desde el navegador. También incluye unos cuantos modos: versus IA, versus jugadores online o en local, y todas sus variantes.

Hace tiempo que tenía un juego así en mente y hacerlo a la vieja usanza me habría llevado probablemente un año o dos. Pese a estar vibecodeado en su totalidad, no es un trabajo de dos dias: un LLM no sabe cómo se tiene que sentir el juego al jugarlo, no te puede hacer de tester ni de diseñador.

## Detalles sobre Fuboh.com

Cuando vi el dominio libre no me lo pensé mucho: lo hago.

Investigué qué tecnologías usar para hacerlo web y muy accesible. Di con Babylon.js como game engine, Rapier3D para las físicas y Colyseus para el multijugador. Hace unos años habría sido bastante más complicado hacerlo sin estas librerías extraordinarias y abiertas. Gracias por existir.

### Proceso

Refino una spec inicial con Claude Desktop, donde ya le especifico lo que quiero y cómo lo quiero: lenguajes, librerías, estilo, target final, qué está dentro del scope y qué fuera, y haciendo que me pregunte sobre el proyecto hasta tener algo más concreto. Después le pido que me ayude a escribir los prompts, los reviso y voy paso a paso pidiendo que implemente cada uno y revisando el resultado ejecutando el juego.
Para cada escenario y musica he tenido que hacer un prompt especifico con sus respectivos refinamientos para arreglar defectos.

### Código

El juego está vibecodeado usando Claude Code, mayormente con el modelo Claude Opus 5. Para el sonido, los escenarios y algunas mejoras del menú he usado Kimi K3 y GPT 5.6 (Sol y Luna).

### Prompts

Generados por IA a partir de la spec refinada. Unos 10 en total, basicamente dividen cada partado del videojuego; menus, controles, sonido, modelos 3D...
Con algunos prompts ha estado una hora trabajando solo. Al terminar solia abrir un nuevo chat para ir refinando los detalles que no funcionan bien y arreglando bugs antes de pasar al siguiente prompt.

#### Herramientas de IA

He usado Claude Code y opencode, el MCP de [context7](https://context7.com/) y las skills que me recomendó [autoskills](https://www.autoskills.sh/). Solo he tenido un CLAUDE.md; opencode hace fallback a él, así que no hace falta tener ambos.

### Estilo visual

Teniendo que ser 3D, para navegador y jugable en VR, no hay muchas más opciones que usar low poly para asegurar el tiro y no tener que optimizar despues. Es más, el juego no calcula sombras: las que ves son "artificiales", como si fuera un PNG estirado puesto directamente debajo de la pelota o de los muñecos.

En el movil los FPS rondan los 50-70 y en PC con una RTX 4070 TI casi llega a 300 deslimitando el navegador. Por defecto limitado a 144 FPS.

### Sonido

Para el sonido he recortado un trozo de audio de una partida de futbolín, se lo he pasado a GPT 5.6 Sol y le he dicho que lo reproduzca programáticamente teniendo en cuenta la velocidad, etc. Ha hecho magia.

La parte musical está hecha con el MCP de Resonant y convertidas a webm con ffmpeg.

### Despliegue y costes

Por ahora, lo que he gastado en el juego han sido 10€ del dominio en cloudflare y el coste de la subscripciones de IA en estas dos semanas, 40€/2 entre GPT y Claude. No solo he estado haciendo el juego asi que digamos, otros 10-15€ de IA.

En servidores por ahora he gastado 0. Estoy usando el mes gratuito de <https://railway.com/> para el servidor multijugador autoritativo. Como el juego no tiene actividad ninguna seguramente lo cierre al acabar el mes, finales de agosto de 2026.
Para el hosting web he usado clodflare, asi que 0€.

En total 25€ redondeando por lo alto.

## Lecciones aprendidas

Con este ya son unos cuantos proyectos que hago usando LLMs y diferentes herramientas para controlarlos.

* Siempre he recomendado ir poquito a poco y teniendo el control sobre el código generado. Esto lo sigo recomendando, pero con una excepción: si simplemente quieres hacer un prototipo para ver si funciona y no te importa no tener el control, ya puedes ver que el resultado no es tan malo. Ten en mente que para hacer cualquier cambio, aunque sea mínimo, dependes de la IA o de tener tiempo para andar rebuscando en ficheros.
* Recuperar el ownership del proyecto una vez perdido puede ser costoso.
* Un LLM es capaz de resíntetizar sonidos a partir de un fichero WAV. Mayor compresión que esa es complicada de conseguir.
* También es capaz de diseñar en 3D escenarios, figuras y lo que haga falta. No esperes mucha definición ni que salga perfecto a la primera: es normal que ponga las caras del revés y veas el modelo negro.
* El modo plan gasta muchos tokens, no siempre merece la pena. Con el juego del futbolín alcanzaba contextos de 150k o 300k tokens rápido.
* Los tests son aún más importantes, y también que sean rápidos. En el fichero AGENTS.md o equivalente merece la pena indicar el flujo de validación que debe tener cada cambio.
